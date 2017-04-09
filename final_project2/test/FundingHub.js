contract('FundingHub', function(accounts) {

  var amount;
  var days;
  var acc;
  var contribution;
  var contributionWei;
  var gas;
  before("", function() {
    amount = 100;
    days = 10;
    acc = accounts[0];
    contribution = web3.toWei(5, "ether")
    gas = 1000000;
  });

  it("should deploy, create, fund, cancel and refund", function() {
    var acc_start_balance;
    var acc_after_fund_balance;
    var acc_end_balance;
    var project_start_balance;
    var project_after_fund_balance;
    var project_end_balance;

    return FundingHub.deployed().createProject(acc, amount, days, {from: acc})
      .then(function(projectAddress) {

      return Project.deployed().getBalance.call();
      }).then(function(balance) {
        project_start_balance = balance.toNumber();
        return web3.eth.getBalance(acc);
      }).then(function(balance) {
        acc_start_balance = balance.toNumber();
        return Project.deployed().fund({from: acc, value: contribution, gas: gas });
      }).then(function(result) {
        assert(result); // Funding complete
        return Project.deployed().getBalance.call();
      }).then(function(balance) {
        project_after_fund_balance = balance.toNumber();
        return web3.eth.getBalance(acc);
      }).then(function(balance) {
        acc_after_fund_balance = balance.toNumber();
        return Project.deployed().cancelProject({from: acc, gas: gas });
      }).then(function(result) {
        assert(result, "Failed"); // Project canceled, refund enabled.
        return Project.deployed().refund({from: acc, gas: gas });
      }).then(function(result) {
        assert(result, "Failed"); // Refund to acc completed
        return web3.eth.getBalance(acc);
      }).then(function(balance) {
        acc_end_balance = balance.toNumber();
        return Project.deployed().getBalance.call();
      }).then(function(balance) {
        project_end_balance = balance.toNumber();

        assert(acc_start_balance - acc_after_fund_balance > contribution, "Failed");
        assert.equal(project_start_balance + contribution, project_after_fund_balance, "Failed");
        assert(acc_start_balance - acc_end_balance < contribution, "Failed");
        assert.equal(project_start_balance, project_end_balance, "Failed") 
      });
    });

});
