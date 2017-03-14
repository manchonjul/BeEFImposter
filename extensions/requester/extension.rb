#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
module Extension
module Requester
  
end
end
end

r = File.expand_path('../', __FILE__)
require "#{r}/models/http.rb"
require "#{r}/api/hook.rb"
require "#{r}/handler.rb"
# TODO re-enable calling the pre_hook_send stuff:
# dhook = BeEF::Extension::Requester::API::Hook.new
# dhook.requester_run(hooked_browser, body)
# see the API class below
# require "#{r}/api.rb"

BeEF::Core::Handlers::Mountpoints.instance.add_int_mountpoint('/requester', BeEF::Extension::Requester::Handler)
