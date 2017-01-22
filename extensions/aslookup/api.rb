#
# Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
module Extension
module ASLookup
  
  module RegisterHttpHandler
    
    BeEF::API::Registrar.instance.register(BeEF::Extension::ASLookup::RegisterHttpHandler, BeEF::API::Server, 'mount_handler')
    
    def self.mount_handler(beef_server)
      beef_server.mount('/aslookup', BeEF::Extension::ASLookup::ASLookupRest.new)
    end
    
  end
  
end
end
end

