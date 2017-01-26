#
# Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
module Extension
module DormantDOMLogger

	extend BeEF::API::Extension

    @short_name = 'dormantdomlogger'
    @full_name = 'Dormant DOM Logger'
    @description = 'A simple logger mount handler for the Dormant DOM ARE modifications'
  
end
end
end

require 'extensions/dormant_dom_logger/handlers'
require 'extensions/dormant_dom_logger/api'
