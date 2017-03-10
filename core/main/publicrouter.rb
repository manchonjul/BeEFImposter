#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#

module BeEF
  module Core
    module Router

      class PublicRouter < Sinatra::Base


        #TODO reset this to false for production
        configure do
          set :show_exceptions, false
        end


        # Generic handler for mount points added at runtime
        get '/*' do
          req_path = request.path_info
          ext_mounts = BeEF::Core::Handlers::Mountpoints.instance.get_ext_mountpoints

          if ext_mounts[req_path] != nil
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
