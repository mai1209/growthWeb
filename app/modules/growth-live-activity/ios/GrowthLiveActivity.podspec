Pod::Spec.new do |s|
  s.name           = 'GrowthLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Live Activity de la caminata (ActivityKit)'
  s.description    = 'Controla la Live Activity de la caminata desde JS.'
  s.author         = ''
  s.homepage       = 'https://www.growthmanager.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
