"""Exercise one explicitly supplied, Browser-owned local Chromium session.

ChromeDriver attaches through debuggerAddress; Vesper remains the profile owner.
This fixture never starts a substitute browser or discovers operator sessions.
"""
import argparse
import hashlib
import importlib.metadata
import json
import pathlib
import re
import time
from urllib.parse import urlparse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--address', required=True)
    parser.add_argument('--driver', required=True)
    parser.add_argument('--driver-sha256', required=True)
    parser.add_argument('--url', required=True)
    parser.add_argument('--marker', required=True)
    parser.add_argument('--phase', choices=['seed', 'restore'], required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    match = re.fullmatch(r'127\.0\.0\.1:([0-9]{1,5})', args.address)
    assert match and 0 < int(match[1]) < 65536, 'Require explicit IPv4 loopback debugger address'
    url = urlparse(args.url)
    assert url.scheme == 'http' and url.hostname == '127.0.0.1' and url.port
    assert not url.username and not url.password and not url.query and not url.fragment
    assert re.fullmatch(r'[A-Za-z0-9_-]{8,80}', args.marker)
    assert re.fullmatch(r'[a-f0-9]{64}', args.driver_sha256)
    executable = pathlib.Path(args.driver).resolve(strict=True)
    assert hashlib.sha256(executable.read_bytes()).hexdigest() == args.driver_sha256
    assert importlib.metadata.version('selenium') == '4.41.0', 'Use the recorded Selenium version'
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    output = pathlib.Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    assert not output.exists(), 'Preserve the prior receipt; use a fresh output'
    report = {'state': 'running', 'seleniumVersion': '4.41.0', 'phase': args.phase,
              'checks': [], 'errors': [], 'browserLaunchedByDriver': False}
    driver = None
    service = Service(executable_path=str(executable), service_args=['--allowed-ips='])
    try:
        options = webdriver.ChromeOptions()
        options.debugger_address = args.address
        driver = webdriver.Chrome(service=service, options=options)
        capabilities = driver.capabilities
        assert capabilities['browserVersion'].startswith('157.0.8100.')
        assert capabilities['chrome']['chromedriverVersion'].startswith('157.0.8103.38 ')
        report['browserVersion'] = capabilities['browserVersion']
        report['driverVersion'] = capabilities['chrome']['chromedriverVersion']
        report['checks'].append('Real Selenium attaches to the existing qualified Chromium157 session')
        driver.set_page_load_timeout(30)
        driver.set_script_timeout(15)
        driver.get(args.url)
        assert driver.title == 'Owned Vesper Selenium fixture'
        assert driver.execute_script('return window.firstIdentity') == {'cpu': 4, 'memory': 4}
        report['checks'].append('Navigation and first-script native preset execute in the Browser-owned profile')
        if args.phase == 'seed':
            field = driver.find_element(By.ID, 'message')
            field.send_keys(args.marker)
            driver.find_element(By.ID, 'save').click()
            WebDriverWait(driver, 15).until(lambda d: d.find_element(By.ID, 'result').text == args.marker)
            assert driver.execute_script('return localStorage.getItem("vesper-selenium")') == args.marker
            driver.add_cookie({'name': 'vesper-selenium', 'value': args.marker,
                               'path': '/', 'expiry': int(time.time()) + 3600, 'sameSite': 'Lax'})
            report['checks'].append('Real input and click perform one owned effect and persist local storage/cookie')
        else:
            assert driver.execute_script('return localStorage.getItem("vesper-selenium")') == args.marker
            assert driver.get_cookie('vesper-selenium')['value'] == args.marker
            report['checks'].append('Independent archive import restores the Selenium-created cookie and local storage')
        driver.switch_to.frame(driver.find_element(By.ID, 'owned-frame'))
        assert driver.find_element(By.ID, 'frame-value').text == 'Owned frame'
        driver.switch_to.default_content()
        assert driver.execute_async_script('const done=arguments[0]; const w=new Worker("/worker.js"); w.onmessage=e=>{w.terminate();done(e.data)};') == 42
        report['checks'].append('Frame switching and asynchronous worker evaluation pass through Selenium')
        driver.save_screenshot(str(output.with_suffix('.png')))
        driver.quit()
        driver = None
        report['driverQuitPassed'] = True
        report['state'] = 'passed'
    except Exception as error:
        report['state'] = 'failed'
        report['errors'].append(type(error).__name__ + ': ' + str(error))
    finally:
        if driver:
            try:
                driver.quit()
            except Exception as error:
                report['errors'].append('Driver cleanup: ' + str(error))
                report['state'] = 'failed'
        service.stop()
        output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'state': report['state'], 'checks': len(report['checks']), 'errors': report['errors']}))
    return 0 if report['state'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
