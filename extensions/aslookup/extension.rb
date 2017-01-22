#
# Copyright (c) 2006-2016 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
module Extension
module ASLookup

	extend BeEF::API::Extension

    @short_name = 'aslookup'
    @full_name = 'ASLookup'
    @description = 'An externally available API into Team Cymru\'s IP TO ASN lookup via DNS http://www.team-cymru.org/IP-ASN-mapping.html'
  
end
end
end

require 'extensions/aslookup/api'
require 'extensions/aslookup/rest/aslookuprest'
