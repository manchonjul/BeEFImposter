#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#
module BeEF
  module Extension
    module SocialEngineering
      extend BeEF::API::Extension
      @short_name = 'social_engineering'
      @full_name = 'Social Engineering'
      @description = 'Phishing attacks for your pleasure: web page cloner (POST interceptor and BeEF goodness), highly configurable mass mailer, powershell-related attacks, etc.'
    end
  end
end

r = File.expand_path('../', __FILE__)
require "#{r}/web_cloner/web_cloner"
require "#{r}/web_cloner/interceptor"
require "#{r}/mass_mailer/mass_mailer"
require "#{r}/powershell/bind_powershell"
require "#{r}/models/web_cloner"
require "#{r}/models/interceptor"
#require "#{r}/models/mass_mailer"
require "#{r}//rest/socialengineering"








