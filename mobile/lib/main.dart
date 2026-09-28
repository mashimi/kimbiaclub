import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF0A0E0C),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const KimbiaMobileApp());
}

class KimbiaMobileApp extends StatelessWidget {
  const KimbiaMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kimbia TZ',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFFE5A93C),
        scaffoldBackgroundColor: const Color(0xFF0A0E0C),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFE5A93C),
          secondary: Color(0xFF10B981),
          surface: Color(0xFF161C18),
          background: Color(0xFF0A0E0C),
        ),
        useMaterial3: true,
      ),
      home: const MainMobileShell(),
    );
  }
}

class MainMobileShell extends StatefulWidget {
  const MainMobileShell({super.key});

  @override
  State<MainMobileShell> createState() => _MainMobileShellState();
}

class _MainMobileShellState extends State<MainMobileShell> {
  int _currentIndex = 0;
  late final WebViewController _webViewController;
  bool _isLoading = true;
  double _loadingProgress = 0.0;
  bool _hasError = false;
  String _currentGpsStatus = "GPS Idle";
  StreamSubscription<Position>? _positionStreamSubscription;
  double _totalDistanceMeters = 0.0;
  Position? _lastPosition;
  bool _isTrackingRun = false;

  final String _appUrl = 'https://newproject-fa93d.web.app';

  @override
  void initState() {
    super.initState();
    _initWebView();
    _checkPermissions();
  }

  void _initWebView() {
    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0A0E0C))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            setState(() {
              _loadingProgress = progress / 100.0;
              if (progress == 100) {
                _isLoading = false;
              }
            });
          },
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
              _hasError = false;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
          },
          onWebResourceError: (WebResourceError error) {
            if (error.isForMainFrame ?? true) {
              setState(() {
                _hasError = true;
                _isLoading = false;
              });
            }
          },
          onNavigationRequest: (NavigationRequest request) {
            if (request.url.startsWith('tel:') || request.url.startsWith('mailto:')) {
              _launchExternalUrl(request.url);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(_appUrl));
  }

  Future<void> _checkPermissions() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
  }

  Future<void> _startGpsTracking() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enable GPS location services on your device.')),
      );
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Location permission is required for GPS run tracking.'),
            duration: const Duration(seconds: 6),
            action: SnackBarAction(
              label: 'OPEN SETTINGS',
              textColor: const Color(0xFFE5A93C),
              onPressed: () {
                Geolocator.openAppSettings();
              },
            ),
          ),
        );
        return;
      }
    }

    setState(() {
      _isTrackingRun = true;
      _totalDistanceMeters = 0.0;
      _lastPosition = null;
      _currentGpsStatus = "Tracking active...";
    });

    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 3,
    );

    _positionStreamSubscription = Geolocator.getPositionStream(locationSettings: locationSettings).listen(
      (Position position) {
        setState(() {
          if (_lastPosition != null) {
            double distanceInMeters = Geolocator.distanceBetween(
              _lastPosition!.latitude,
              _lastPosition!.longitude,
              position.latitude,
              position.longitude,
            );
            _totalDistanceMeters += distanceInMeters;
          }
          _lastPosition = position;
          _currentGpsStatus = "${(_totalDistanceMeters / 1000).toStringAsFixed(2)} km | ${(position.speed * 3.6).toStringAsFixed(1)} km/h";
        });
      },
      onError: (err) {
        setState(() {
          _currentGpsStatus = "GPS Error: $err";
        });
      },
    );
  }

  void _stopGpsTracking() {
    _positionStreamSubscription?.cancel();
    setState(() {
      _isTrackingRun = false;
      _currentGpsStatus = "Run finished: ${(_totalDistanceMeters / 1000).toStringAsFixed(2)} km";
    });
  }

  Future<void> _launchExternalUrl(String url) async {
    final Uri uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  void dispose() {
    _positionStreamSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFF121815),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFE5A93C).withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: const Text('🏃', style: TextStyle(fontSize: 18)),
            ),
            const SizedBox(width: 10),
            RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'sans-serif'),
                children: [
                  TextSpan(text: 'KIMBIA ', style: TextStyle(color: Colors.white)),
                  TextSpan(text: 'TZ', style: TextStyle(color: Color(0xFFE5A93C))),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white70),
            onPressed: () {
              _webViewController.reload();
            },
            tooltip: 'Reload App',
          ),
          IconButton(
            icon: const Icon(Icons.share, color: Colors.white70),
            onPressed: () {
              _launchExternalUrl(_appUrl);
            },
            tooltip: 'Open in Browser',
          ),
        ],
        bottom: _isLoading
            ? PreferredSize(
                preferredSize: const Size.fromHeight(3.0),
                child: LinearProgressIndicator(
                  value: _loadingProgress > 0 ? _loadingProgress : null,
                  backgroundColor: Colors.transparent,
                  color: const Color(0xFFE5A93C),
                ),
              )
            : null,
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          // View 0: Web Application
          _hasError
              ? _buildErrorWidget()
              : RefreshIndicator(
                  onRefresh: () async {
                    _webViewController.reload();
                  },
                  child: WebViewWidget(controller: _webViewController),
                ),

          // View 1: Native GPS Tracker Component
          _buildNativeTrackerView(),

          // View 2: Mobile App Information & SDK Download View
          _buildAppSdkDownloadView(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        backgroundColor: const Color(0xFF121815),
        selectedItemColor: const Color(0xFFE5A93C),
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.web),
            label: 'League App',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.gps_fixed),
            label: 'Native GPS',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.file_download),
            label: 'Mobile SDK',
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 64, color: Colors.orangeAccent),
            const SizedBox(height: 16),
            const Text(
              'Network Offline or Connection Issue',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Unable to reach Kimbia TZ web services. Please check your internet connection.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  _hasError = false;
                  _isLoading = true;
                });
                _webViewController.reload();
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Retry Connection'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE5A93C),
                foregroundColor: Colors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNativeTrackerView() {
    double distanceKm = _totalDistanceMeters / 1000.0;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E2922), Color(0xFF121815)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE5A93C).withOpacity(0.3)),
            ),
            child: Column(
              children: [
                const Text(
                  'NATIVE GPS RUN TRACKER',
                  style: TextStyle(
                    color: Color(0xFFE5A93C),
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  distanceKm.toStringAsFixed(2),
                  style: const TextStyle(
                    fontSize: 48,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                const Text('KILOMETERS', style: TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatItem('SPEED', _lastPosition != null ? '${(_lastPosition!.speed * 3.6).toStringAsFixed(1)} km/h' : '0.0 km/h'),
                    _buildStatItem('STATUS', _currentGpsStatus),
                  ],
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _isTrackingRun ? _stopGpsTracking : _startGpsTracking,
                  icon: Icon(_isTrackingRun ? Icons.stop : Icons.play_arrow),
                  label: Text(_isTrackingRun ? 'STOP TRACKING' : 'START GPS RUN'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isTrackingRun ? Colors.redAccent : const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text('Native Sensor Diagnostics', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ListTile(
            tileColor: const Color(0xFF161C18),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            leading: const Icon(Icons.location_on, color: Color(0xFFE5A93C)),
            title: const Text('High Precision GPS Sensor'),
            subtitle: Text(_lastPosition != null ? 'Lat: ${_lastPosition!.latitude.toStringAsFixed(4)}, Lon: ${_lastPosition!.longitude.toStringAsFixed(4)}' : 'Awaiting position lock'),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
      ],
    );
  }

  Widget _buildAppSdkDownloadView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF161C18),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.android, color: Color(0xFF10B981), size: 32),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Kimbia TZ Mobile App & SDK', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text('Version 1.0.0 (Release Build)', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'Download the full Android APK directly to your device or inspect the integration SDK for automated device testing with Mobile Next.',
                  style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () {
                    _launchExternalUrl('https://newproject-fa93d.web.app/download/kimbiaclub.apk');
                  },
                  icon: const Icon(Icons.download),
                  label: const Text('Download Android APK (Direct Link)'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE5A93C),
                    foregroundColor: Colors.black,
                    minimumSize: const Size(double.infinity, 46),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text('Mobile Next E2E & Automation SDK', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF121815),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'This mobile application is fully instrumented with Mobilewright & Mobile Next SDK for real device testing on Mobile Next Cloud (mobilenext.ai).',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: () {
                    _launchExternalUrl('https://mobilenext.ai/docs');
                  },
                  child: const Text(
                    '📖 View Mobile Next Documentation (https://mobilenext.ai/docs)',
                    style: TextStyle(color: Color(0xFFE5A93C), fontSize: 12, decoration: TextDecoration.underline),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
