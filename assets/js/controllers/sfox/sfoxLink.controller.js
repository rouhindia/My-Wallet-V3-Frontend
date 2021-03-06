angular
  .module('walletApp')
  .controller('SfoxLinkController', SfoxLinkController);

function SfoxLinkController ($scope, AngularHelper, $q, $sce, $timeout, sfox, modals, Env, $window) {
  let exchange = $scope.vm.exchange;
  let accounts = $scope.vm.accounts;
  if (sfox.activeAccount) $scope.vm.close(true);

  Env.then(env => {
    $scope.plaidUrl = $sce.trustAsResourceUrl(`${env.walletHelperDomain}/wallet-helper/plaid/#/key/${env.partners.sfox.plaid}/env/${ env.partners.sfox.plaidEnv}`);
  });

  $scope.namespace = 'SFOX';
  $scope.types = ['checking', 'savings'];
  $scope.openHelper = modals.openHelper;

  let state = $scope.state = {
    plaid: {},
    terms: false,
    accounts: accounts,
    enableBankAccountForm: !!$scope.$root.inMobileBuy
  };

  $scope.fields = {
    deposit1: undefined,
    deposit2: undefined,
    accountName: undefined,
    routingNumber: undefined,
    accountNumber: undefined,
    type: 'checking',
    bankAccount: undefined
  };

  $scope.forms = {};

  $scope.displayInlineError = (error) => {
    let bankForm = $scope.forms.bankAccountForm;
    let verifyForm = $scope.$$childHead.verifyBankAccountForm;
    switch (sfox.interpretError(error)) {
      case 'must provide routing number':
        bankForm.routingNumber.$setValidity('value', false);
        break;
      case 'must provide account number':
        bankForm.accountNumber.$setValidity('value', false);
        break;
      case 'invalid amounts':
        verifyForm.deposit1.$setValidity('value', false);
        verifyForm.deposit2.$setValidity('value', false);
        break;
      default:
        sfox.displayError(error);
    }
  };

  $scope.clearInlineErrors = (form, ...fields) => {
    fields.forEach(f => form[f].$setValidity('value', true));
  };

  $scope.link = () => {
    $scope.lock();

    let addAccount = (methods) => methods.ach.addAccount(
      $scope.fields.routingNumber,
      $scope.fields.accountNumber,
      $scope.fields.accountName,
      $scope.fields.type
    );

    $q.resolve(exchange.getBuyMethods())
      .then(addAccount)
      .then(account => state.accounts[0] = account)
      .catch($scope.displayInlineError)
      .finally($scope.free);
  };

  $scope.verify = () => {
    $scope.lock();
    $q.resolve(state.accounts[0].verify($scope.fields.deposit1, $scope.fields.deposit2))
      .then(() => $scope.vm.close(true))
      .catch($scope.displayInlineError)
      .finally($scope.free);
  };

  $scope.getBankAccounts = (token) => {
    $scope.token = token;
    $q.resolve(exchange.bankLink.getAccounts($scope.token))
      .then((bankAccounts) => $scope.state.bankAccounts = bankAccounts)
      .then(() => $scope.fields.bankAccount = $scope.state.bankAccounts[0])
      .catch(sfox.displayError);
  };

  $scope.setBankAccount = () => {
    $scope.lock();
    let obj = {
      token: $scope.token,
      name: $scope.fields.accountName,
      id: $scope.fields.bankAccount._id
    };

    $q.resolve(exchange.bankLink.setAccount(obj))
      .then(() => $scope.vm.close(true))
      .catch(sfox.displayError)
      .finally($scope.free);
  };

  $scope.enablePlaid = () => $scope.state.plaid.enabled = true;
  $scope.disablePlaid = () => $scope.state.plaid = {};
  $scope.plaidWhitelist = ['enablePlaid', 'disablePlaid', 'getBankAccounts'];

  Env.then(env => {
    let receiveMessage = (e) => {
      if (!e.data.command) return;
      if (e.data.from !== 'plaid') return;
      if (e.data.to !== 'exchange') return;
      if (e.origin !== env.walletHelperDomain) return;
      if ($scope.plaidWhitelist.indexOf(e.data.command) < 0) return;

      e.data.msg ? $scope[e.data.command](e.data.msg) : $scope[e.data.command]();
      AngularHelper.$safeApply($scope);
    };

    $window.addEventListener('message', receiveMessage, false);
  });

  AngularHelper.installLock.call($scope);
}
