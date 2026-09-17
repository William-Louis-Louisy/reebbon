Pod::Spec.new do |s|
  s.name           = 'ReebbonCbrPoc'
  s.version        = '0.1.0'
  s.summary        = 'Technical POC for bounded native CBR extraction'
  s.description    = 'Non-product Expo module proving a shared UnRAR Android/iOS architecture.'
  s.license        = { :type => 'UnRAR', :file => 'native/unrar/license.txt' }
  s.author         = 'Reebbon'
  s.homepage       = 'https://github.com/William-Louis-Louisy/reebbon'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/William-Louis-Louisy/reebbon.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version  = '5.9'

  unrar_sources = %w[
    rar strlist strfn pathfn smallfn global file filefn filcreat archive arcread
    unicode system crypt crc rawread encname resource match timefn rdwrfn consio
    options errhnd rarvm secpassword rijndael getbits sha1 sha256 blake2s hash
    extinfo extract volume list find unpack headers threadpool rs16 cmddata ui
    largepage filestr scantree dll qopen
  ].map { |name| "native/unrar/#{name}.cpp" }

  s.source_files = [
    'ios/**/*.{h,mm,swift}',
    'native/reebbon_cbr_poc.{hpp,cpp}',
    *unrar_sources,
  ]
  s.public_header_files = 'ios/ReebbonCbrPocBridge.h'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'DEFINES_MODULE' => 'YES',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) _FILE_OFFSET_BITS=64 _LARGEFILE_SOURCE RARDLL',
    'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -Oz -fexceptions -fvisibility=hidden -ffunction-sections -fdata-sections -Wno-dangling-else -Wno-logical-op-parentheses -Wno-switch',
  }
end
