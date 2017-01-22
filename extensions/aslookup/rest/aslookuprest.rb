#
# Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
  module Extension
    module ASLookup

      require 'ipaddr'
      require 'dnsruby'
      include Dnsruby

      # This class handles the routing of RESTful API requests to the ASLookup
      #   service
      class ASLookupRest < BeEF::Core::Router::Router

        # Filters out bad requests before performing any routing
        before do
          config = BeEF::Core::Configuration.instance

          # Require a valid API token from a valid IP address
          # halt 401 unless params[:token] == config.get('beef.api_token')
          # halt 403 unless BeEF::Core::Rest.permitted_source?(request.ip)

          headers 'Content-Type' => 'application/json; charset=UTF-8',
                  'Pragma' => 'no-cache',
                  'Cache-Control' => 'no-cache',
                  'Expires' => '0',
                  'Access-Control-Allow-Origin' => '*'
        end

        get '/' do
          result = {}

          return result unless BeEF::Filters.is_valid_ip?(request.ip, :ipv4)

          ipaddr = IPAddr.new(request.ip)
          rev = ipaddr.reverse.chomp(".in-addr.arpa")

          resolver = Dnsruby::Resolver.new
          asn = resolver.query(rev+".origin.asn.cymru.com","TXT")
          org = resolver.query("AS"+asn.answer[0].strings[0].split(" ")[0]+".asn.cymru.com","TXT")
          org = org.answer[0].strings[0].split("|")[4].strip

          result['ip'] = request.ip
          result['asn'] = org
          result.to_json
        end
      end

    end
  end
end

