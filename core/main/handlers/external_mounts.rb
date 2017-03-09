#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
  module Core
    module Handlers

      # @note This class handles connections from hooked browsers to the framework.
      class ExternalMounts < BeEF::Core::Router::Router

        configure do
          disable :protection
        end

        # This is where new assets can be mounted on the web server at runtime.
        # External mounts points are stored in memory via the Mountpoints class.
        # To add a new Handler:
        #BeEF::Core::Handlers::Mountpoints.instance.add_ext_mountpoint(
        #   '/test.js' , '200', {'Content-Type' => 'text/html'}, '<b>LOL</B>'
        # )
        # then you can request the mounted file via http(s)://beef/l/test.js
        # Paths can be nested without problems (good for phishing) like /test/nested.js
        # However the initali URL must be always starting with /l/ unless this logic
        # is moved into the Core::Router (which is in TODO :-)

        get "/l/*" do
          req_path = request.path_info.gsub('/l/','/')
          ext_mounts = BeEF::Core::Handlers::Mountpoints.instance.get_ext_mountpoints

          if ext_mounts[req_path] != nil
            print_info ext_mounts[req_path].inspect
            begin
              ext_mounts[req_path]
            rescue Exception => e
              print_error "#{e.message}\n#{e.backtrace}"
            end
          else
            status 404
          end
        end
      end
    end
  end
end