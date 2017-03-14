#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
module Extension
module Evasion
  extend BeEF::API::Extension

  @short_name = 'evasion'
  @full_name = 'Evasion'
  @description = 'Contains Evasion and Obfuscation techniques to prevent the likelihood that BeEF will be detected'
end
end
end

r = File.expand_path('../', __FILE__)
require "#{r}/evasion.rb"
require "#{r}/helper.rb"
require "#{r}/obfuscation/scramble.rb"
require "#{r}/obfuscation/minify.rb"
require "#{r}/obfuscation/base_64.rb"
require "#{r}/obfuscation/whitespace.rb"
