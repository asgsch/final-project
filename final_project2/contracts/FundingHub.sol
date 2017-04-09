pragma solidity 0.4.3;

contract FundingHub {
    address[] private deployedProjects;
    address private owner;
    bool private isFundingHubOpen = true;

    function FundingHub() {
         owner = tx.origin;
    }

    function createProject(
        address owner, 
        uint amountToRaise, 
        uint deadlineInDays
    ) external returns (address) {
        if (!isFundingHubOpen)
            throw;

        address projectAddress = new Project(owner, amountToRaise, deadlineInDays);
        deployedProjects.push(projectAddress);

        return projectAddress;
    }

    function contribute(address projectAddress) external payable {
        Project project = Project(projectAddress);
        uint contribution = msg.value;
        
        project.fund.value(contribution)();
    }

    function closeFundingHub() {
        if (owner == msg.sender)
            isFundingHubOpen = false;
    }

    function getDeployedProjects() public returns (address[]) {
        return deployedProjects;
    }
	
    function getProject(address projectAddress) public returns (Project) {
        return Project(projectAddress);
    }

    function() { }
}


contract Project {
    struct Info {
        address owner;
        uint amountToRaise;
        uint deadline;
    }
    
    uint public constant maxAmountToRaise = 1000000000 ether;
    uint public constant maxDeadlineInDays = 365 days; 
    Info private info;
    address[] private contributors;
    mapping(address => uint) private contributions;
    uint private contributionTotal;
    bool private projectCancelled = false;
    
    function Project(address owner, uint amountToRaise, uint deadlineInDays) {
        if (amountToRaise > maxAmountToRaise)
            throw;
        if (deadlineInDays > maxDeadlineInDays)
            throw;

        uint deadline = now + deadlineInDays * 24 hours;
        info = Info(owner, amountToRaise, deadline);
    }
    
    function fund() external payable {
        address contributor = tx.origin;
        uint contribution = msg.value;
        uint existingContribution = contributions[contributor];
        bool isFullAmountReached = contributionTotal >= info.amountToRaise;
        bool isDeadlinePassed = now > info.deadline;
	    
        if (isDeadlinePassed || isFullAmountReached) {   	    
            if (isFullAmountReached) {
                payout();
            } 
            else {
                projectCancelled = true;
                refund();
            }
   	}
        else {
   	    uint contributedAlready = contributions[contributor];
   	    contributors.push(contributor);
   	    contributions[contributor] = contributedAlready + contribution;
   	    contributionTotal += contribution;
   	}
    }
    
    function payout() private {
        bool result = info.owner.send(this.balance);
        if (!result)
            throw;
        selfdestruct(info.owner); 
    }
    
    function refund() public returns (bool) {
        bool result = false;
        if (!projectCancelled)
            return result;

        address contributor = tx.origin;
        uint contribution = contributions[contributor];
        result = contributor.send(contribution);

        if (!result)
            throw;

        contributionTotal -= contribution;

        if (isRefundComplete())
            selfdestruct(info.owner);
         
        return result;
    }

    function isRefundComplete() public returns (bool) {
        return getBalance() == 0 && projectCancelled;
    }

    function cancelProject() external returns (bool) {
	if (info.owner == msg.sender)
            projectCancelled = true;
	        
        return projectCancelled;
    }

    function getAmountToRaise() public returns (uint) {
        return info.amountToRaise;
    }

    function isDeadlinePassed() public returns (bool) {
        return now > info.deadline;
    }

    function getContributionTotal() public returns (uint) {
        return contributionTotal;
    }

    function getBalance() public returns (uint) {
        return this.balance;
    }

    function getContributors() public returns (address[]) {
        return contributors;
    }
	
    function() { }
    
}
