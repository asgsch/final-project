pragma solidity 0.4.3;

contract FundingHub {
    
	address[] deployedProjects;

	function FundingHub() {

	}

	function createProject(address _owner, uint _amountToRaise, uint _deadlineInDays) returns (address _deployedAddress) {
    	address projectAddress = new Project(_owner, _amountToRaise, _deadlineInDays);
    	deployedProjects.push(projectAddress);
    	
    	return projectAddress;
	}

    function contribute(address projectAddress) payable {
        Project project = Project(projectAddress);
        uint contribution = msg.value;
        
        project.fund.value(contribution)();
    }

	function() {

	}
	
	function getDeployedProjects() returns (address[] _deployedContracts) {
	    return deployedProjects;
	}
	
	function getProject(address projectAddress) returns (Project _project) {
	    return Project(projectAddress);
	}
}


contract Project {
    
    struct Info {
        address owner;
        uint amountToRaise;
        uint deadline;
    }
    
    Info info;
    address[] contributors;
    mapping(address => uint) contributions;
    uint contributionTotal;
    bool projectCancelled = false;
    
	function Project(address _owner, uint _amountToRaise, uint _deadlineInDays) {
	    uint deadline = now + _deadlineInDays * 24 hours;
	    info = Info(_owner, _amountToRaise, deadline);
	}
    
	function fund() payable {
	    address contributor = tx.origin;
	    uint contribution = msg.value;
	    uint existingContribution = contributions[contributor];
	    bool isFullAmountReached = contributionTotal >= info.amountToRaise;
	    bool isDeadlinePassed = now > info.deadline;
	    
   	    if (isDeadlinePassed || isFullAmountReached) {
   	        bool result = contributor.send(msg.value); // Refund current contribution attempt.
   	    
            if (isFullAmountReached) {
                payout();
            } else {
                projectCancelled = true;
                refund();
            }
   	    } else {
   	        uint contributedAlready = contributions[contributor];
   	        contributors.push(contributor);
   	        contributions[contributor] = contributedAlready + contribution;
   	        contributionTotal += contribution;
   	    }
	}
    
	function payout() {
        bool result = info.owner.send(this.balance);
	}
    
	function refund() returns (bool _result) {
	    bool result = false;
	    if (projectCancelled) {
	        address contributor = tx.origin;
	        uint contribution = contributions[contributor];
	        result = contributor.send(contribution);
	    }
	    return result;
	}
	
	function cancelProject() public returns (bool _result) {
	    if (info.owner == msg.sender)
	        projectCancelled = true;
	        
	    return projectCancelled;
	}
	
	function getAmountToRaise() public returns (uint _amountToRaise) {
	    return info.amountToRaise;
	}
	
	function isDeadlinePassed() public returns (bool _isDeadlinePassed) {
	    return now > info.deadline;
	}
	
	function getContributionTotal() public returns (uint _contributionTotal) {
	    return contributionTotal;
	}
	
    function getBalance() public returns (uint _balance) {
	    return this.balance;
	}
	
	function getContributors() public returns (address[] _contributors) {
	    return contributors;
	}
	
	function() {
	
	}
    
}
