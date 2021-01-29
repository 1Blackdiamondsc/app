import React, { Component } from 'react';
import { connect } from 'react-redux';
import { fetchSendDataRequest } from '../../reducer';
import {
  sendToAddress,
  isValidAddress,
  handleFetchRegularDFI,
} from '../../service';
import { LEDGER_PATH } from '@/constants';
import {
  getAddressForSymbolLedger,
  accountToAccountConversionLedger,
  getAmountInSelectedUnit,
  isLessThanDustAmount, getSymbolKey,
} from '@/utils/utility';
import { RootState } from '@/app/rootReducer';
import * as log from '@/utils/electronLogger';
import BigNumber from 'bignumber.js';
import qs from 'querystring';
import { Helmet } from 'react-helmet';
import { I18n } from 'react-redux-i18n';
import Header from '@/containers/HeaderComponent';
import {
  Button,
  Col,
  Form,
  FormGroup,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Label,
  Modal, ModalBody, Row,
} from 'reactstrap';
import { NavLink } from 'react-router-dom';
import { MdArrowBack, MdCheckCircle, MdCropFree, MdErrorOutline } from 'react-icons/md';
import QrReader from 'react-qr-reader';
import classnames from 'classnames';
import Spinner from '@/components/Svg/Spinner';
import styles from '@/containers/WalletPage/WalletPage.module.scss';
import UIfx from 'uifx';
import shutterSound from '@/assets/audio/shutter.mp3';
import { PaymentRequestLedger } from '@/typings/models';

const shutterSnap = new UIfx(shutterSound);

interface SendPageProps {
  unit: string;
  location?: any;
  sendData: {
    walletBalance: number;
    amountToSend: string | number;
    amountToSendDisplayed: number | string;
    toAddress: string;
    scannerOpen: boolean;
    flashed: string;
    showBackdrop: string;
    sendStep: string;
    waitToSend: number;
  };
  paymentRequests: PaymentRequestLedger[];
  fetchSendData: () => void;
  isValidAddress: (toAddress: string) => boolean;
  getAddressForSymbol: (
    hash: string,
    list: any[]
  ) => { address: string; maxAmount: number; keyIndex: number };
  accountToAccountConversion: (
    addressList: PaymentRequestLedger[],
    toAddress: string,
    hash: string
  ) => Promise<any>;
  cancelPagePath: string;
  networkName: string;
}

interface SendPageState {
  walletBalance: number;
  amountToSend: string | number;
  amountToSendDisplayed: number | string;
  toAddress: string;
  scannerOpen: boolean;
  flashed: string;
  showBackdrop: string;
  sendStep: string;
  waitToSend: number;
  isAmountValid: boolean | string;
  isAddressValid: boolean | string;
  uriData: string;
  errMessage: string;
  regularDFI: string | number;
  txHash: string;
}

class SendPage extends Component<SendPageProps, SendPageState> {
  waitToSendInterval;
  urlParams = new URLSearchParams(this.props.location.search);
  tokenSymbol = this.urlParams.get('symbol');
  tokenHash = this.urlParams.get('hash');
  tokenAmount = this.urlParams.get('amount');
  tokenAddress = this.urlParams.get('address');

  state = {
    walletBalance: 0,
    amountToSend: '',
    amountToSendDisplayed: 0,
    toAddress: '',
    scannerOpen: false,
    flashed: '',
    showBackdrop: '',
    sendStep: 'default',
    waitToSend: 5,
    isAmountValid: false,
    isAddressValid: false,
    uriData: '',
    errMessage: '',
    regularDFI: '',
    txHash: '',
  };

  componentDidMount() {
    this.props.fetchSendData();
  }

  updateAmountToSend = (e) => {
    const { value } = e.target;
    if (isNaN(value) && value.length) return false;

    const amountToSend = !isNaN(value) && value.length ? value : '';
    const amountToSendDisplayed =
      !isNaN(amountToSend) && amountToSend.length ? amountToSend : 0;
    this.setState({ amountToSend, amountToSendDisplayed }, () => {
      this.isAmountValid();
    });
  };

  updateToAddress = (e) => {
    const toAddress = e.target.value;
    this.setState(
      {
        toAddress,
      },
      this.isAddressValid
    );
  };

  maxAmountToSend = () => {
    let amount;
    if (!this.tokenSymbol) {
      amount = getAmountInSelectedUnit(
        this.props.sendData.walletBalance,
        this.props.unit
      );
    } else {
      amount = this.tokenAmount;
    }
    this.setState(
      {
        amountToSend: amount,
        amountToSendDisplayed: amount,
      },
      () => {
        this.isAmountValid();
      }
    );
  };

  openScanner = () => {
    this.setState({
      scannerOpen: true,
    });
  };

  toggleScanner = () => {
    this.setState({
      scannerOpen: !this.state.scannerOpen,
    });
  };

  handleScan = (data) => {
    const updatedState = {
      flashed: 'flashed',
      toAddress: '',
      uriData: '',
    };
    if (data) {
      if (data.includes('DFI')) {
        updatedState.uriData = data;
      } else {
        updatedState.toAddress = data;
      }
      shutterSnap.play();
      this.setState(updatedState);
      setTimeout(() => {
        this.isQRCodeValid();
        this.toggleScanner();
        this.setState({
          flashed: '',
        });
      }, 600);
    }
  };

  countDownWaitToSend = () => {
    this.waitToSendInterval = setInterval(() => {
      this.setState({
        waitToSend: this.state.waitToSend - 1,
      });
      if (this.state.waitToSend === 0) {
        clearInterval(this.waitToSendInterval);
      }
    }, 1000);
  };

  handleScanError = (err) => {
    log.error(err);
  };

  handleSuccess = (txHash) => {
    this.setState({
      sendStep: 'success',
      showBackdrop: 'show-backdrop',
      txHash,
    });
  };

  handleFailure = (error) => {
    this.setState({
      sendStep: 'failure',
      showBackdrop: 'show-backdrop',
      errMessage: error.message,
    });
  };

  handleLoading = () => {
    this.setState({
      sendStep: 'loading',
      showBackdrop: '',
    });
  };

  sendStepDefault = () => {
    this.setState({
      sendStep: 'default',
      showBackdrop: '',
      waitToSend: 5,
    });
    clearInterval(this.waitToSendInterval);
  };

  sendStepConfirm = () => {
    this.countDownWaitToSend();
    this.setState({
      sendStep: 'confirm',
      showBackdrop: 'show-backdrop',
      errMessage: '',
    });
  };

  sendTransaction = async () => {
    this.handleLoading();
    const { isAmountValid, isAddressValid } = this.state;
    const regularDFI = await handleFetchRegularDFI();
    this.setState({
      regularDFI,
    });
    if (isAmountValid && isAddressValid) {
      let amount;
      let txHash;
      try {
        let accountToAccountAmount = new BigNumber(0);
        const hash = this.tokenHash || '0';
        const {
          address,
          maxAmount,
          keyIndex,
        } = await this.props.getAddressForSymbol(
          hash,
          this.props.paymentRequests
        );
        amount = this.state.amountToSendDisplayed;
        if (Number(amount) > maxAmount) {
          accountToAccountAmount = await this.props.accountToAccountConversion(
            this.props.paymentRequests,
            this.state.toAddress,
            hash
          );
        } else {
          // TODO change toaddress after testing transaction p2sh
          txHash = await sendToAddress(
            'ttVsZL1vmt25hWC2WKzJZcPEXAiMQrKpVA',
            this.state.toAddress,
            amount,
            hash,
            2,
          );
        }
        this.handleSuccess(txHash);
      } catch (error) {
        this.handleFailure(error);
      }
    }
  };

  isAmountValid = async () => {
    let amount;
    if (!this.tokenSymbol) {
      amount = getAmountInSelectedUnit(
        this.props.sendData.walletBalance,
        this.props.unit
      );
    } else {
      amount = this.tokenAmount;
    }

    const isLessThanBalance = new BigNumber(
      this.state.amountToSendDisplayed
    ).lte(amount);

    const isAmountValid =
      this.state.amountToSend &&
      this.state.amountToSendDisplayed > 0 &&
      isLessThanBalance &&
      !isLessThanDustAmount(this.state.amountToSendDisplayed, this.props.unit);
    this.setState({ isAmountValid });
  };

  isQRCodeValid = async () => {
    const { uriData } = this.state;
    if (!!uriData) {
      const start = uriData.indexOf(':');
      const end = uriData.indexOf('?');
      const toAddress = uriData.substring(start + 1, end);
      const queryData = uriData.substring(end + 1);
      const params = qs.parse(queryData);
      const amountData = getAmountInSelectedUnit(
        params.amount as string,
        this.props.unit
      );
      this.updateAmountToSend({ target: { value: amountData } });
      this.setState({
        toAddress,
        uriData: '',
      });
    }
    this.isAddressValid();
  };

  isAddressValid = async () => {
    let isAddressValid = false;
    if (
      this.state.toAddress.length >= 26 && // address, is an identifier of 26-35 alphanumeric characters
      this.state.toAddress.length <= 35
    ) {
      isAddressValid = await this.props.isValidAddress(this.state.toAddress);
    }
    this.setState({ isAddressValid });
  };

  render() {
    const { tokenSymbol, tokenHash, tokenAmount, tokenAddress } = this;
    return (
      <div className='main-wrapper'>
        <Helmet>
          <title>{I18n.t('containers.ledger.sendPage.sendTitle')}</title>
        </Helmet>
        <Header>
          <Button
            to={
              tokenSymbol
                ? `${this.props.cancelPagePath}?symbol=${tokenSymbol}&hash=${tokenHash}&amount=${tokenAmount}&address=${tokenAddress}`
                : this.props.cancelPagePath
            }
            tag={NavLink}
            color='link'
            className='header-bar-back'
          >
            <MdArrowBack />
            <span className='d-lg-inline'>
              {I18n.t('containers.ledger.sendPage.wallet')}
            </span>
          </Button>
          <h1>
            {I18n.t('containers.ledger.sendPage.send')}{' '}
            {getSymbolKey(tokenSymbol || '', tokenHash || '0') ||
            this.props.unit}
          </h1>
        </Header>
        <div className='content'>
          <section>
            <Form>
              <FormGroup className='form-label-group form-row'>
                <Col>
                  <InputGroup>
                    {/* TODO: show inline error for failed vaildation */}
                    <Input
                      type='text'
                      inputMode='numeric'
                      placeholder={I18n.t(
                        'containers.ledger.sendPage.amountToSend'
                      )}
                      name='amountToSend'
                      id='amountToSend'
                      value={this.state.amountToSend}
                      onChange={this.updateAmountToSend}
                      autoFocus
                    />
                    <Label for='amountToSend'>
                      {I18n.t('containers.ledger.sendPage.amount')}
                    </Label>
                    <InputGroupAddon addonType='append'>
                      <InputGroupText>
                        {getSymbolKey(tokenSymbol || '', tokenHash || '0') ||
                        this.props.unit}
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Col>
                <Col className='col-auto'>
                  <Button
                    color='outline-primary'
                    onClick={this.maxAmountToSend}
                  >
                    {I18n.t('containers.ledger.sendPage.MAX')}
                  </Button>
                </Col>
              </FormGroup>
              <FormGroup className='form-label-group'>
                <InputGroup>
                  <Input
                    type='text'
                    placeholder={I18n.t(
                      'containers.ledger.sendPage.dfiAddress'
                    )}
                    name='toAddress'
                    id='toAddress'
                    value={this.state.toAddress}
                    onChange={this.updateToAddress}
                  />
                  <Label for='toAddress'>
                    {I18n.t('containers.ledger.sendPage.toAddress')}
                  </Label>
                  <InputGroupAddon addonType='append'>
                    <Button color='outline-primary' onClick={this.openScanner}>
                      <MdCropFree />
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </FormGroup>
            </Form>
            <Modal
              isOpen={this.state.scannerOpen}
              toggle={this.toggleScanner}
              centered={true}
              className={`qr-scanner ${this.state.flashed}`}
            >
              <ModalBody>
                <QrReader
                  delay={1000}
                  onError={this.handleScanError}
                  onScan={this.handleScan}
                  showViewFinder={false}
                  className='qr-scanner-preview w-100'
                />
              </ModalBody>
            </Modal>
          </section>
        </div>
        <footer className='footer-bar'>
          <div
            className={classnames({
              'd-none': this.state.sendStep !== 'default',
            })}
          >
            <Row className='justify-content-between align-items-center'>
              <Col className='col-auto'>
                <div className='caption-secondary'>
                  {I18n.t('containers.ledger.sendPage.walletBalance')}
                </div>
                <div>
                  {!tokenSymbol
                    ? getAmountInSelectedUnit(
                      this.props.sendData.walletBalance,
                      this.props.unit
                    )
                    : tokenAmount}
                  &nbsp;
                  {tokenSymbol
                    ? getSymbolKey(tokenSymbol || '', tokenHash || '0')
                    : this.props.unit}
                </div>
              </Col>
              <Col className='col-auto'>
                <div className='caption-secondary'>
                  {I18n.t('containers.ledger.sendPage.amountToSend')}
                </div>
                <div>
                  {this.state.amountToSendDisplayed}&nbsp;
                  {getSymbolKey(tokenSymbol || '', tokenHash || '0') ||
                  this.props.unit}
                </div>
              </Col>
              <Col className='d-flex justify-content-end'>
                <Button
                  to={this.props.cancelPagePath}
                  tag={NavLink}
                  color='link'
                  className='mr-3'
                >
                  {I18n.t('containers.ledger.sendPage.cancel')}
                </Button>
                <Button
                  color='primary'
                  disabled={
                    !this.state.isAmountValid || !this.state.isAddressValid
                  }
                  onClick={this.sendStepConfirm}
                >
                  {I18n.t('containers.ledger.sendPage.continue')}
                </Button>
              </Col>
            </Row>
          </div>
          <div
            className={classnames({
              'd-none': this.state.sendStep !== 'confirm',
            })}
          >
            <div className='footer-sheet'>
              <dl className='row'>
                <dt className='col-sm-3 text-right'>
                  {I18n.t('containers.ledger.sendPage.amount')}
                </dt>
                <dd className='col-sm-9'>
                  <span className='h2 mb-0'>
                    {this.state.amountToSend}&nbsp;
                    {getSymbolKey(tokenSymbol || '', tokenHash || '0') ||
                    this.props.unit}
                  </span>
                </dd>
                <dt className='col-sm-3 text-right'>
                  {I18n.t('containers.ledger.sendPage.to')}
                </dt>
                <dd className='col-sm-9'>{this.state.toAddress}</dd>
              </dl>
            </div>
            <Row className='justify-content-between align-items-center'>
              <Col className='col'>
                {I18n.t('containers.ledger.sendPage.pleaseVerifyAmount')}
              </Col>
              <Col className='d-flex justify-content-end'>
                <Button
                  color='link'
                  className='mr-3'
                  onClick={this.sendStepDefault}
                >
                  {I18n.t('containers.ledger.sendPage.cancel')}
                </Button>
                <Button
                  color='primary'
                  onClick={this.sendTransaction}
                  disabled={this.state.waitToSend > 0}
                >
                  {I18n.t('containers.ledger.sendPage.completeSend')}&nbsp;
                  <span className='timer'>
                    {this.state.waitToSend > 0 ? this.state.waitToSend : ''}
                  </span>
                </Button>
              </Col>
            </Row>
          </div>
          <div
            className={classnames({
              'd-none': this.state.sendStep !== 'success',
            })}
          >
            <div className='footer-sheet'>
              <div className='text-center'>
                <MdCheckCircle className='footer-sheet-icon' />
                <p>
                  {I18n.t('containers.ledger.sendPage.transactionSuccessMsg')}
                </p>
                <div>
                  <b>{I18n.t('containers.ledger.sendPage.txHash')}</b> : &nbsp;
                  <span>{this.state.txHash}</span>
                </div>
              </div>
            </div>
            <div className='d-flex align-items-center justify-content-center'>
              <Button
                color='primary'
                to={
                  tokenSymbol
                    ? `${this.props.cancelPagePath}?symbol=${tokenSymbol}&hash=${tokenHash}&amount=${tokenAmount}&address=${tokenAddress}`
                    : this.props.cancelPagePath
                }
                tag={NavLink}
              >
                {I18n.t('containers.ledger.sendPage.backToWallet')}
              </Button>
            </div>
          </div>
          <div
            className={classnames({
              'd-none': this.state.sendStep !== 'loading',
            })}
          >
            <div className='footer-sheet'>
              <div className='text-center'>
                <Spinner />
              </div>
            </div>
          </div>
          <div
            className={classnames({
              'd-none': this.state.sendStep !== 'failure',
            })}
          >
            <div className='footer-sheet'>
              <div className='text-center'>
                <MdErrorOutline
                  className={classnames({
                    'footer-sheet-icon': true,
                    [styles[`error-dialog`]]: true,
                  })}
                />
                <p>{this.state.errMessage}</p>
              </div>
            </div>
            <div className='d-flex align-items-center justify-content-center'>
              <Button
                color='primary'
                to={
                  tokenSymbol
                    ? `${this.props.cancelPagePath}?symbol=${tokenSymbol}&hash=${tokenHash}&amount=${tokenAmount}&address=${tokenAddress}`
                    : this.props.cancelPagePath
                }
                tag={NavLink}
              >
                {I18n.t('containers.ledger.sendPage.backToWallet')}
              </Button>
            </div>
          </div>
        </footer>
        <div
          className={`footer-backdrop ${this.state.showBackdrop}`}
          onClick={this.sendStepDefault}
        />
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => {
  const { ledgerWallet, settings, wallet } = state;
  return {
    unit: settings.appConfig.unit,
    sendData:ledgerWallet.sendData,
    paymentRequests: ledgerWallet.paymentRequests,
  };
};

const mapDispatchToProps = {
  fetchSendData: fetchSendDataRequest,
};

const mergerProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...stateProps,
  ...dispatchProps,
  isValidAddress,
  getAddressForSymbol: getAddressForSymbolLedger,
  accountToAccountConversion: accountToAccountConversionLedger,
  cancelPagePath: LEDGER_PATH,
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergerProps
)(SendPage);
