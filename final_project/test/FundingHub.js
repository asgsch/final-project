contract('FundingHub', function(accounts) {

  it("should contribute 5 to project", function() {
    var fundingHub = FundingHub.deployed();

    return fundingHub.createProject(accounts[0], 100, 10, {from: accounts[0]}).then(function(projectAddress) {
      Project.deployed().fund({from: accounts[0], value: 5, gas: 1000000 }).then	(function(result) {
        Project.deployed().getBalance.call().then(function(balance) {
	  assert.equal(balance.toNumber(), 5, "Failed");
	});
      });
    });
  });

  it("should contribute/fund 5 and refund 5", function() {
    var fundingHub = FundingHub.deployed();

    return fundingHub.createProject(accounts[0], 100, 10, {from: accounts[0]}).then(function(projectAddress) {
      Project.deployed().fund({from: accounts[0], value: 5, gas: 1000000 }).then	(function(result) {
        Project.deployed().cancelProject({from: accounts[0], gas: 1000000 }).then(function(cancelResult) {
	  Project.deployed().refund({from: accounts[0], gas: 1000000 }).then(function(refundResult) {
	    Project.deployed().getBalance.call().then(function(balance) {
	      assert.equal(balance.toNumber(), 0, "Failed");
	    });
	  });
        });
      });
    });
  });

});
