#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
module Extension
module Requester

  module RegisterPreHookCallback

    BeEF::API::Registrar.instance.register(BeEF::Extension::Requester::RegisterPreHookCallback, BeEF::API::Server::Hook, 'pre_hook_send')

    def self.pre_hook_send(hooked_browser, body, params, request, response)
        dhook = BeEF::Extension::Requester::API::Hook.new
        dhook.requester_run(hooked_browser, body)
    end

  end
  
end
end
end
