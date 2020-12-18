// @ts-nocheck
import React from 'react';
import WalletPage from '../index';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import store from '../../../app/rootStore';
import { mount } from 'enzyme';
import {
  history,
  match,
  location,
} from '../../../utils/testUtils/routeComponentProps';

describe('WalletPage component', () => {
  it('should check for snapshot', () => {
    const wrapper = mount(
      <Router>
        <Provider store={store}>
          <WalletPage history={history} location={location} match={match} />
        </Provider>
      </Router>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
