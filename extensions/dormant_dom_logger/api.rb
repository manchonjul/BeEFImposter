#
# Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
module Extension
module DormantDOMLogger
  
  module RegisterHttpHandler
    
    BeEF::API::Registrar.instance.register(BeEF::Extension::DormantDOMLogger::RegisterHttpHandler, BeEF::API::Server, 'mount_handler')
    
    # A simple logging endpoint
    def self.mount_handler(beef_server)
      beef_server.mount('/dormantdomlogger', BeEF::Extension::DormantDOMLogger::Logger)
    end
    
  end
  
end
end
end

