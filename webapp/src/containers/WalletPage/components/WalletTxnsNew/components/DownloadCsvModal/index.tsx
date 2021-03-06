import React from 'react';
import { MdArrowDownward } from 'react-icons/md';
import { I18n } from 'react-redux-i18n';
import {
  Modal,
  ModalBody,
  ModalFooter,
  Button,
  Col,
  FormGroup,
  Row,
  CustomInput,
  ModalHeader,
  Alert,
} from 'reactstrap';
import CsvRowInput from '../../CsvRowInput';
import { CSVLink } from 'react-csv';
import { TXN_CSV_HEADERS } from '../../../../../../constants';
import Spinner from '../../../../../../components/Svg/Spinner';

interface Reqdata {
  blockHeight: number;
  limit: number;
  token: string;
  no_rewards: boolean;
}

interface TransactionData {
  amounts: string[];
  blockHash: string;
  blockHeight: number;
  blockTime: number;
  owner: string;
  poolID: string;
  type: string;
  txId?: string;
  txn?: number;
}

interface DownloadCsvModalProps {
  reqData: Reqdata;
  error: string;
  CsvModalOpen: boolean;
  handleCsvButtonClick: () => void;
  tokenSymbol: string;
  toggle: () => void;
  handleRegularNumInputs: (e: any, field: string) => void;
  handleCheckBox: () => void;
  filename: string;
  handleDownloadWindow: () => void;
  transactionData: TransactionData;
  downloadDisable: boolean;
}

const DownloadCsvModal: React.FunctionComponent<DownloadCsvModalProps> = (
  props: DownloadCsvModalProps
) => {
  const {
    CsvModalOpen,
    toggle,
    handleRegularNumInputs,
    handleCheckBox,
    error,
    filename,
    handleDownloadWindow,
    transactionData,
    reqData,
    downloadDisable,
  } = props;

  return (
    <Modal isOpen={CsvModalOpen} centered fade={false} toggle={toggle}>
      <ModalHeader toggle={toggle}>
        {I18n.t('containers.wallet.walletPage.downloadTransaction')}
      </ModalHeader>
      <ModalBody>
        <Row className='ml-5'>
          <Col md='4'>{I18n.t('containers.wallet.walletPage.maxBlock')}</Col>
          <Col md='8' lg='6'>
            <FormGroup className='form-label-group'>
              <CsvRowInput
                fieldName={'blockHeight'}
                label={''}
                value={reqData.blockHeight}
                name={'blockHeight'}
                id={'maximumAmount'}
                placeholder={'Number'}
                handleInputs={handleRegularNumInputs}
              />
            </FormGroup>
          </Col>
          <Col md='4'>{I18n.t('containers.wallet.walletPage.limit')}</Col>
          <Col md='8' lg='6'>
            <FormGroup className='form-label-group'>
              <CsvRowInput
                fieldName={'limit'}
                label={''}
                name={'limit'}
                value={reqData.limit}
                id={'limit'}
                placeholder={'Number'}
                handleInputs={handleRegularNumInputs}
              />
            </FormGroup>
          </Col>
          <Col>
            <CustomInput
              type='checkbox'
              id='no_rewards'
              label={I18n.t('containers.wallet.walletPage.noReward')}
              onChange={handleCheckBox}
            />
          </Col>
        </Row>
        <Row className='mt-2'>
          <Col md='12'>{error && <Alert color='danger'>{error}</Alert>}</Col>
        </Row>
      </ModalBody>
      <ModalFooter>
        <CSVLink
          filename={filename}
          onClick={handleDownloadWindow}
          data={transactionData}
          headers={TXN_CSV_HEADERS}
        >
          <Button color='primary' disabled={downloadDisable}>
            {downloadDisable ? <Spinner /> : <MdArrowDownward />}
            <span className='d-lg-inline'>
              {I18n.t('containers.wallet.walletPage.download')}
            </span>
          </Button>
        </CSVLink>
      </ModalFooter>
    </Modal>
  );
};

export default DownloadCsvModal;
