#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
  module Core
    module Handlers
      class Mountpoints
        include Singleton

        def initialize
          @internal_mount_points = {
              '/init' => BeEF::Core::Handlers::BrowserDetails,
              '/hook.js' => BeEF::Core::Handlers::HookedBrowsers,
              '/event' => BeEF::Core::Handlers::Events
          }

          @external_mount_points = {
              # examples
              # '/2.js' => Rack::Response.new(body = '2 - JS', status = 200, header = {'Content-Type' => 'text/plain'}),
              # '/3.js' => Rack::Response.new(body = '3 - JS', status = 200, header = {'Content-Type' => 'text/plain'})
          }
        end

        def add_int_mountpoint(path , klass)
          @internal_mount_points[path] = klass
        end

        def get_int_mountpoints
          @internal_mount_points
        end

        def add_ext_mountpoint(path , status, header, body)
          @external_mount_points[path] = Rack::Response.new(body = body, status = status, header = header)
        end

        def get_ext_mountpoints
          @external_mount_points
        end

      end
    end
  end
end