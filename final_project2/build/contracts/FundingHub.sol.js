var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("FundingHub error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("FundingHub error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("FundingHub contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of FundingHub: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to FundingHub.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: FundingHub not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "152": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "projectAddress",
            "type": "address"
          }
        ],
        "name": "contribute",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getDeployedProjects",
        "outputs": [
          {
            "name": "_deployedContracts",
            "type": "address[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_owner",
            "type": "address"
          },
          {
            "name": "_amountToRaise",
            "type": "uint256"
          },
          {
            "name": "_deadlineInDays",
            "type": "uint256"
          }
        ],
        "name": "createProject",
        "outputs": [
          {
            "name": "_deployedAddress",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "projectAddress",
            "type": "address"
          }
        ],
        "name": "getProject",
        "outputs": [
          {
            "name": "_project",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "type": "constructor"
      },
      {
        "payable": false,
        "type": "fallback"
      }
    ],
    "unlinked_binary": "0x606060405261067c806100126000396000f3606060405236156100405760e060020a600035046373e888fd81146100485780637ac3886e146100a0578063bad4a2c51461010e578063f9870705146101a7575b34610002575b005b6100466004356000600082915034905081600160a060020a031663b60d4288826040518260e060020a0281526004018090506000604051808303818588803b156100025761235a5a03f1156100025750505050505050565b34610002576040805160208082018352600080835280548451818402810184019095528085526101cc949283018282801561010457602002820191906000526020600020905b8154600160a060020a031681526001909101906020018083116100e6575b5050505050905090565b34610002576101b06004356024356044356000600084848460405161042e8061024e8339018084600160a060020a031681526020018381526020018281526020019350505050604051809103906000f0801561000257905060006000508054806001018281815481835581811511610216576000838152602090206102169181019083015b8082111561024a5760008155600101610193565b34610002576004355b60408051600160a060020a039092168252519081900360200190f35b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390f35b505050600092835250602090912001805473ffffffffffffffffffffffffffffffffffffffff191682179055949350505050565b509056606060408190526006805460ff19169055808061042e8139505160805160a05161012060405260c083905260e08290526201518002420161010081905260008054600160a060020a03191690931783556001919091556002556103c790819061006790396000f3606060405236156100775760e060020a600035046312065fe0811461007f5780631adff0ee146100965780634844a4c0146100d2578063590e1ae3146100e257806363bd1d4a146100ef578063911152bc14610125578063af157c1914610137578063b60d4288146101a8578063de1f5e1c14610220575b34610002575b005b3461000257610230600160a060020a033016315b90565b346100025761024260008054600160a060020a03908116339190911614156100c6576006805460ff191660011790555b5060065460ff16610093565b3461000257610230600554610093565b3461000257610242610267565b346100025761007d5b60008054604051600160a060020a039182169130163180156108fc029184818181858888f1505050505050565b34610002576102426002544211610093565b3461000257604080516020808201835260008252600380548451818402810184019095528085526102bc949283018282801561019c57602002820191906000526020600020905b8154600160a060020a0316815260019091019060200180831161017e575b50505050509050610093565b61007d600160a060020a033290811660009081526004602052604081205460015460055460025434949290911015914291909111908082806101e75750835b1561030657604051600160a060020a038816903480156108fc02916000818181858888f19350505050915083156102565761035e6100f8565b3461000257610230600154610093565b60408051918252519081900360200190f35b604080519115158252519081900360200190f35b6006805460ff191660011790556103635b60065460009081908190819060ff16156102b457505032600160a060020a0381166000818152600460205260408082205490519092916108fc841502918491818181858888f19650505050505b509092915050565b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390f35b50600160a060020a0386166000908152600460205260409020546003805460018101808355828183801582901161036a5760008381526020902061036a9181019083015b808211156103c3576000815560010161034a565b610365565b505b6103ba565b5050506000928352506020808320909101805473ffffffffffffffffffffffffffffffffffffffff19168a179055600160a060020a03891682526004905260409020868201905560058054870190555b50505050505050565b509056",
    "events": {},
    "updated_at": 1488223458136,
    "links": {},
    "address": "0x7d4226e4e2851e7899f2c733bb50b449aa16d6b4"
  },
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [],
        "name": "closeFundingHub",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "projectAddress",
            "type": "address"
          }
        ],
        "name": "contribute",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getDeployedProjects",
        "outputs": [
          {
            "name": "",
            "type": "address[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "owner",
            "type": "address"
          },
          {
            "name": "amountToRaise",
            "type": "uint256"
          },
          {
            "name": "deadlineInDays",
            "type": "uint256"
          }
        ],
        "name": "createProject",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "projectAddress",
            "type": "address"
          }
        ],
        "name": "getProject",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "type": "constructor"
      },
      {
        "payable": false,
        "type": "fallback"
      }
    ],
    "unlinked_binary": "0x60606040526001805460a060020a60ff0219167401000000000000000000000000000000000000000017905560018054600160a060020a031916321790556107b38061004b6000396000f36060604052361561004b5760e060020a60003504633dc30e7c811461005657806373e888fd146100965780637ac3886e146100ee578063bad4a2c51461015c578063f98707051461019c575b34610002576101c15b565b34610002576001546101c19033600160a060020a0390811691161415610054576001805474ff000000000000000000000000000000000000000019169055565b6101c16004356000600082915034905081600160a060020a031663b60d4288826040518260e060020a0281526004018090506000604051808303818588803b156100025761235a5a03f1156100025750505050505050565b34610002576040805160208082018352600080835280548451818402810184019095528085526101c3949283018282801561015257602002820191906000526020600020905b8154600160a060020a03168152600190910190602001808311610134575b5050505050905090565b34610002576101a5600435602435604435600154600090819060ff7401000000000000000000000000000000000000000090910416151561020d57610002565b34610002576004355b60408051600160a060020a039092168252519081900360200190f35b005b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390f35b8484846040516104ea806102c98339018084600160a060020a031681526020018381526020018281526020019350505050604051809103906000f0801561000257905060006000508054806001018281815481835581811511610291576000838152602090206102919181019083015b808211156102c5576000815560010161027d565b505050600092835250602090912001805473ffffffffffffffffffffffffffffffffffffffff191682179055949350505050565b509056606060408190526006805460ff1916905580806104ea81395060c06040525160805160a05160006b033b2e3c9fd0803ce8000000831115608d576002565b5060408051606081018252848152602081018490524262015180840201910181905260008054600160a060020a03191685179055600183905560028190555050505061044e8061009c6000396000f35b6301e13380821115603d576002566060604052361561008d5760e060020a600035046312065fe081146100955780631adff0ee146100a25780633d4c4b93146100de5780634844a4c0146100eb57806356efe00a146100fb578063590e1ae3146101135780635cc070c814610120578063911152bc14610130578063af157c1914610142578063b60d4288146101b3578063de1f5e1c14610237575b34610002575b005b346100025761024761026c565b346100025761027b60008054600160a060020a03908116339190911614156100d2576006805460ff191660011790555b5060065460ff16610278565b346100025761027b610266565b3461000257610247600554610278565b34610002576102476b033b2e3c9fd0803ce800000081565b346100025761027b6102a0565b34610002576102476301e1338081565b346100025761027b6002544211610278565b3461000257604080516020808201835260008252600380548451818402810184019095528085526102bd94928301828280156101a757602002820191906000526020600020905b8154600160a060020a03168152600190910190602001808311610189575b50505050509050610278565b610093600160a060020a0332908116600090815260046020526040812054600154600554600254349492909110159142919091119081806101f15750825b1561038057821561028f576103d860008054604051600160a060020a039182169130163180156108fc029184818181858888f19350505050905080151561044057610002565b3461000257610247600154610278565b60408051918252519081900360200190f35b60058054829003905561036d5b60006103075b600160a060020a033016315b90565b604080519115158252519081900360200190f35b6006805460ff191660011790556103dd5b60065460009081908190819060ff16151561032757829350610321565b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390f35b158015610316575060065460ff165b9050610278565b8293505b50505090565b505032600160a060020a0381166000818152600460205260408082205490519092916108fc841502918491818181858888f1965050508415159150610259905057610002565b1561031d57600054600160a060020a0316ff5b50600160a060020a038516600090815260046020526040902054600380546001810180835582818380158290116103e4576000838152602090206103e49181019083015b8082111561043c57600081556001016103c4565b6103df565b505b610434565b5050506000928352506020808320909101805473ffffffffffffffffffffffffffffffffffffffff191689179055600160a060020a03881682526004905260409020858201905560058054860190555b505050505050565b5090565b600054600160a060020a0316ff",
    "events": {},
    "updated_at": 1491744906767,
    "links": {},
    "address": "0xe6b315967faa1a3ff5dd9073a7b364b9bd56924c"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "FundingHub";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.FundingHub = Contract;
  }
})();
