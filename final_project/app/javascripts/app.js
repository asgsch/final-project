var accounts;
var account;

function getProjects() {
  FundingHub.deployed().getDeployedProjects.call().then(function(projectsArray) {
    var html = "";
    for (i = 0; i < projectsArray.length; i++) { 
	var projectAddress = projectsArray[i];
	var projectCount = (i + 1);
        html += projectCount + ". Project Address: " + projectAddress + "<br>";
        html += "<button onclick='getAmountToRaise(&quot;" + projectAddress + "&quot;)'>amount to raise</button>";
        html += "<button onclick='contribute(&quot;" + projectAddress + "&quot;)'>contribute 5</button>";
        html += "<button onclick='getContributionTotal(&quot;" + projectAddress + "&quot;)'>contribution total</button>";
        html += "<button onclick='getBalance(&quot;" + projectAddress + "&quot;)'>balance</button>";
        html += "<button onclick='cancelProject(&quot;" + projectAddress + "&quot;)'>cancelProject</button>";
        html += "<button onclick='refund(&quot;" + projectAddress + "&quot;)'>refund</button>";
        html += "<button onclick='getContributors(&quot;" + projectAddress + "&quot;)'>getContributors</button>";

	html += "<br>";
    }

    document.getElementById("projects").innerHTML = html;
  }).catch(function(e) {
    console.log(e);
    setStatus("Error getting balance; see log.");
  });


}

function getAmountToRaise(projectAddress) {
	Project.at(projectAddress).getAmountToRaise.call().then(function(amountToRaise) {
          
          console.log("Amount to raise:" + amountToRaise);
	}).catch(function(e) {
	  console.log(e);
	  setStatus("Error getting balance; see log.");
	});
}

function getContributionTotal(projectAddress) {
	Project.at(projectAddress).getContributionTotal.call().then(function(contributionTotal) {
          console.log("contributionTotal:" + contributionTotal);
	}).catch(function(e) {
	  console.log(e);
	  setStatus("Error getting balance; see log.");
	});
}

function getBalance(projectAddress) {
	Project.at(projectAddress).getBalance.call().then(function(balance) {
          console.log("balance:" + balance);
	}).catch(function(e) {
	  console.log(e);
	  setStatus("Error getting balance; see log.");
	});
}

function getContributors(projectAddress) {
	Project.at(projectAddress).getContributors.call().then(function(contributors) {
          console.log("contributors:" + contributors);
	}).catch(function(e) {
	  console.log(e);
	  setStatus("Error getting balance; see log.");
	});
}

function cancelProject(projectAddress) {
	Project.at(projectAddress).cancelProject({from: account}).then(function(result) {
          console.log(result);
	}).catch(function(e) {
	  console.log(e);
	  setStatus("Error getting balance; see log.");
	});
}

function refund(projectAddress) {
	Project.at(projectAddress).refund({from: account}).then(function(result) {
          console.log("refund: " + result);
	}).catch(function(e) {
	  console.log(e);
	  setStatus("Error getting balance; see log.");
	});
}

function contribute(projectAddress) {
	Project.at(projectAddress).fund({from: account, value: 5, gas: 1000000 }).then(function(result) {
          
          console.log(result);
	}).catch(function(e) {
	  console.log(e);
	  setStatus("Error getting balance; see log.");
	});
}

function createProject() {
  var account = accounts[0];
  var amountToRaise = document.getElementById("amountToRaise").value;
  var daysToDeadline = document.getElementById("daysToDeadline").value;
  FundingHub.deployed().createProject(account, amountToRaise, daysToDeadline, {from: account}).then(function(value) {
    console.log('createProject');
    console.log(value);
  }).catch(function(e) {
    console.log(e);
    setStatus("Error getting balance; see log.");
  });
}


window.onload = function() {
  web3.eth.getAccounts(function(err, accs) {
    if (err != null) {
      alert("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

    accounts = accs;
    account = accounts[0];

  });
}
