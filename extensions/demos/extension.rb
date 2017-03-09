#
# Copyright (c) 2006-2017 Wade Alcorn - wade@bindshell.net
# Browser Exploitation Framework (BeEF) - http://beefproject.com
# See the file 'doc/COPYING' for copying permission
#

require "#{File.expand_path('../', __FILE__)}/handler.rb"

module BeEF
module Extension
module Demos
  
  extend BeEF::API::Extension
  
  @short_name = 'demos'
  
  @full_name = 'demonstrations'
  
  @description = 'Demonstration pages for BeEF'

  path = File.dirname(__FILE__)+'/html/'
  files = Dir[path+'**/*']

  @mounts = BeEF::Core::Handlers::Mountpoints.instance


  # beef_server.mount('/demos', Rack::File.new(path))

  files.each do |f|
    # don't follow symlinks
    next if File.symlink?(f)
    mount_path = '/demos/'+f.sub(path,'')
    if File.extname(f) == '.html'
      # use handler to mount HTML templates
      config = BeEF::Core::Configuration.instance
      eruby = Erubis::FastEruby.new(File.read(f))
      body = eruby.evaluate({'hook_uri' => config.get("beef.http.hook_file")})

      @mounts.add_ext_mountpoint(mount_path, '200', {}, body)
    end
  end
  
end
end
end


