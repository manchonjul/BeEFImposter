#
# Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
  module Extension
    module DormantDOMLogger

      #
      # The http handler that manages the WebRTC messages sent from browsers.
      #
      class Logger

        Z = BeEF::Core::Models::HookedBrowser

        def initialize(data)
          @data = data
          setup()
        end

        def setup()
          # validates the hook token
          beef_hook = @data['beefhook'] || nil
          (print_error "beefhook is null";return) if beef_hook.nil?

          # validates the message
          message = @data['results']['message'] || nil
          (print_error "Message is null";return) if message.nil?

          # validates that a hooked browser with the beef_hook token exists in the db
          zombie_db = Z.first(:session => beef_hook) || nil
          (print_error "Invalid beefhook id: the hooked browser cannot be found in the database";return) if zombie_db.nil?

          # Writes the event into the BeEF Logger
          BeEF::Core::Logger.instance.register('Dormant DOM', "Browser (#{zombie_db.id}): #{message}")

        end

      end
    end
  end
end

