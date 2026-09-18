cmake_minimum_required(VERSION 3.22.1)
project(reebbon_cbr_poc LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(UNRAR_SOURCES
  unrar/rar.cpp
  unrar/strlist.cpp
  unrar/strfn.cpp
  unrar/pathfn.cpp
  unrar/smallfn.cpp
  unrar/global.cpp
  unrar/file.cpp
  unrar/filefn.cpp
  unrar/filcreat.cpp
  unrar/archive.cpp
  unrar/arcread.cpp
  unrar/unicode.cpp
  unrar/system.cpp
  unrar/crypt.cpp
  unrar/crc.cpp
  unrar/rawread.cpp
  unrar/encname.cpp
  unrar/resource.cpp
  unrar/match.cpp
  unrar/timefn.cpp
  unrar/rdwrfn.cpp
  unrar/consio.cpp
  unrar/options.cpp
  unrar/errhnd.cpp
  unrar/rarvm.cpp
  unrar/secpassword.cpp
  unrar/rijndael.cpp
  unrar/getbits.cpp
  unrar/sha1.cpp
  unrar/sha256.cpp
  unrar/blake2s.cpp
  unrar/hash.cpp
  unrar/extinfo.cpp
  unrar/extract.cpp
  unrar/volume.cpp
  unrar/list.cpp
  unrar/find.cpp
  unrar/unpack.cpp
  unrar/headers.cpp
  unrar/threadpool.cpp
  unrar/rs16.cpp
  unrar/cmddata.cpp
  unrar/ui.cpp
  unrar/largepage.cpp
  unrar/filestr.cpp
  unrar/scantree.cpp
  unrar/dll.cpp
  unrar/qopen.cpp
)

add_library(reebbon-cbr-core STATIC
  ${UNRAR_SOURCES}
  reebbon_cbr_poc.cpp
)
target_include_directories(reebbon-cbr-core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_definitions(reebbon-cbr-core PRIVATE
  _FILE_OFFSET_BITS=64
  _LARGEFILE_SOURCE
  _POSIX_C_SOURCE=200809L
  RARDLL
)
target_compile_options(reebbon-cbr-core PRIVATE
  -fexceptions
  -fvisibility=hidden
  -ffunction-sections
  -fdata-sections
  $<$<CONFIG:Release>:-Oz>
  -Wno-dangling-else
  -Wno-logical-op-parentheses
  -Wno-switch
)

if(ANDROID)
  add_library(reebbon-cbr-poc SHARED ../android/src/main/cpp/reebbon_cbr_jni.cpp)
  target_compile_options(reebbon-cbr-poc PRIVATE
    -fexceptions
    -fvisibility=hidden
    $<$<CONFIG:Release>:-Oz>
  )
  target_link_libraries(reebbon-cbr-poc PRIVATE reebbon-cbr-core log)
  target_link_options(reebbon-cbr-poc PRIVATE -Wl,--gc-sections)
endif()

option(REEBBON_CBR_BUILD_NATIVE_TESTS "Build the native POC safety tests" OFF)
if(REEBBON_CBR_BUILD_NATIVE_TESTS)
  add_executable(reebbon-cbr-native-tests tests/reebbon_cbr_poc_test.cpp)
  target_link_libraries(reebbon-cbr-native-tests PRIVATE reebbon-cbr-core)
endif()
