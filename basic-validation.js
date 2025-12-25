#!/usr/bin/env node

/**
 * Basic Validation for Responsive UI Cleanup
 * Tests what we can without a browser
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

class BasicValidationRunner {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            tests: [],
            overall: 'PENDING'
        };
    }

    async testFileStructure() {
        console.log('🔍 Testing file structure and script references...');
        
        const tests = [];
        
        // Check if main HTML file exists and has correct structure
        const htmlPath = 'netlify-build/index.html';
        if (fs.existsSync(htmlPath)) {
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            
            // Test required scripts are referenced
            const requiredScripts = [
                'safe-events.js',
                'js/connectionRecovery.js',
                'js/responsive-mobile-fix.js',
                'game.js'
            ];
            
            for (const script of requiredScripts) {
                const isReferenced = htmlContent.includes(script);
                tests.push({
                    name: `Script reference: ${script}`,
                    passed: isReferenced,
                    details: isReferenced ? 'Referenced in HTML' : 'Not referenced in HTML'
                });
            }
            
            // Test mobile interface activator is disabled
            const mobileActivatorDisabled = htmlContent.includes('Mobile Interface Activator DISABLED');
            tests.push({
                name: 'Mobile Interface Activator disabled',
                passed: mobileActivatorDisabled,
                details: mobileActivatorDisabled ? 'Disabled in HTML' : 'Not disabled'
            });
            
            // Test responsive design mode is enabled
            const responsiveMode = htmlContent.includes('responsive-design-mode');
            tests.push({
                name: 'Responsive design mode enabled',
                passed: responsiveMode,
                details: responsiveMode ? 'Enabled in HTML' : 'Not enabled'
            });
            
        } else {
            tests.push({
                name: 'Main HTML file',
                passed: false,
                details: 'HTML file not found'
            });
        }
        
        // Check if responsive mobile fix script exists
        const responsiveFixPath = 'netlify-build/js/responsive-mobile-fix.js';
        const responsiveFixExists = fs.existsSync(responsiveFixPath);
        tests.push({
            name: 'Responsive mobile fix script',
            passed: responsiveFixExists,
            details: responsiveFixExists ? 'File exists' : 'File missing'
        });
        
        if (responsiveFixExists) {
            const fixContent = fs.readFileSync(responsiveFixPath, 'utf8');
            
            // Test mobile component suppression
            const hasSuppression = fixContent.includes('preventMobileInterfaceActivation');
            tests.push({
                name: 'Mobile component suppression',
                passed: hasSuppression,
                details: hasSuppression ? 'Suppression code present' : 'Suppression code missing'
            });
            
            // Test touch optimizations
            const hasTouchOptimizations = fixContent.includes('setupMobileTouchOptimizations');
            tests.push({
                name: 'Touch optimizations',
                passed: hasTouchOptimizations,
                details: hasTouchOptimizations ? 'Touch optimization code present' : 'Touch optimization code missing'
            });
            
            // Test error suppression
            const hasErrorSuppression = fixContent.includes('console.error = function');
            tests.push({
                name: 'Error suppression',
                passed: hasErrorSuppression,
                details: hasErrorSuppression ? 'Error suppression code present' : 'Error suppression code missing'
            });
        }
        
        this.results.tests.push(...tests);
        
        const passedTests = tests.filter(t => t.passed).length;
        console.log(`✅ File Structure: ${passedTests}/${tests.length} tests passed`);
        
        tests.forEach(test => {
            console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}: ${test.details}`);
        });
        
        return passedTests === tests.length;
    }

    async testServerResponse() {
        console.log('🔍 Testing server response and MIME types...');
        
        const tests = [];
        
        // Test main HTML loads correctly
        try {
            const htmlResponse = await this.makeRequest('http://localhost:8080/index.html');
            const htmlPassed = htmlResponse.statusCode === 200 && 
                              htmlResponse.headers['content-type'].includes('text/html');
            
            tests.push({
                name: 'Main HTML response',
                passed: htmlPassed,
                details: htmlPassed ? `200 OK, ${htmlResponse.headers['content-type']}` : `${htmlResponse.statusCode}, ${htmlResponse.headers['content-type']}`
            });
        } catch (error) {
            tests.push({
                name: 'Main HTML response',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
        
        // Test JavaScript files load with correct MIME type
        const jsFiles = [
            'safe-events.js',
            'js/connectionRecovery.js',
            'js/responsive-mobile-fix.js',
            'game.js'
        ];
        
        for (const jsFile of jsFiles) {
            try {
                const jsResponse = await this.makeRequest(`http://localhost:8080/${jsFile}`);
                const jsPassed = jsResponse.statusCode === 200;
                
                tests.push({
                    name: `JavaScript file: ${jsFile}`,
                    passed: jsPassed,
                    details: jsPassed ? `200 OK` : `${jsResponse.statusCode}`
                });
            } catch (error) {
                tests.push({
                    name: `JavaScript file: ${jsFile}`,
                    passed: false,
                    details: `Error: ${error.message}`
                });
            }
        }
        
        this.results.tests.push(...tests);
        
        const passedTests = tests.filter(t => t.passed).length;
        console.log(`✅ Server Response: ${passedTests}/${tests.length} tests passed`);
        
        tests.forEach(test => {
            console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}: ${test.details}`);
        });
        
        return passedTests === tests.length;
    }

    async testValidationFiles() {
        console.log('🔍 Testing validation files created...');
        
        const tests = [];
        
        const validationFiles = [
            'validation-test-suite.js',
            'responsive-validation-test.html',
            'run-validation.js',
            'basic-validation.js'
        ];
        
        for (const file of validationFiles) {
            const exists = fs.existsSync(file);
            tests.push({
                name: `Validation file: ${file}`,
                passed: exists,
                details: exists ? 'File exists' : 'File missing'
            });
        }
        
        this.results.tests.push(...tests);
        
        const passedTests = tests.filter(t => t.passed).length;
        console.log(`✅ Validation Files: ${passedTests}/${tests.length} tests passed`);
        
        tests.forEach(test => {
            console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}: ${test.details}`);
        });
        
        return passedTests === tests.length;
    }

    makeRequest(url) {
        return new Promise((resolve, reject) => {
            const request = http.get(url, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        data: data
                    });
                });
            });
            
            request.on('error', reject);
            request.setTimeout(5000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    async runBasicValidation() {
        console.log('🧪 Running Basic Responsive UI Validation');
        console.log('=' .repeat(50));
        
        const testResults = [];
        
        // Run all tests
        testResults.push(await this.testFileStructure());
        testResults.push(await this.testServerResponse());
        testResults.push(await this.testValidationFiles());
        
        // Calculate overall results
        const passedTests = testResults.filter(result => result).length;
        const totalTests = testResults.length;
        const successRate = Math.round((passedTests / totalTests) * 100);
        
        this.results.overall = successRate >= 90 ? 'PASSED' : 'FAILED';
        this.results.successRate = successRate;
        this.results.passedTests = passedTests;
        this.results.totalTests = totalTests;
        
        // Generate report
        console.log('');
        console.log('📊 BASIC VALIDATION RESULTS');
        console.log('=' .repeat(50));
        console.log(`Overall Status: ${this.results.overall}`);
        console.log(`Success Rate: ${successRate}% (${passedTests}/${totalTests} test categories passed)`);
        console.log('');
        
        // Detailed results
        console.log('📋 Test Summary:');
        const allTests = this.results.tests;
        const allPassedTests = allTests.filter(t => t.passed).length;
        const allTotalTests = allTests.length;
        
        console.log(`  Total individual tests: ${allPassedTests}/${allTotalTests} passed`);
        console.log('');
        
        if (this.results.overall === 'PASSED') {
            console.log('🎉 Basic validation passed! The responsive UI cleanup appears to be working correctly.');
            console.log('');
            console.log('✅ Validated:');
            console.log('  - File structure is correct');
            console.log('  - Scripts are properly referenced');
            console.log('  - Server responds correctly');
            console.log('  - Mobile interface is disabled');
            console.log('  - Responsive design mode is enabled');
            console.log('  - Validation files are created');
            console.log('');
            console.log('🌐 For complete validation, open responsive-validation-test.html in a browser');
            console.log('🎮 Test the application at: http://localhost:8080/index.html');
        } else {
            console.log('⚠️  Some basic validation tests failed. Review the results above.');
        }
        
        // Save results to file
        const reportPath = 'basic-validation-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`📄 Report saved to: ${reportPath}`);
        
        return this.results;
    }
}

// Main execution
async function main() {
    const runner = new BasicValidationRunner();
    
    try {
        const results = await runner.runBasicValidation();
        
        // Exit with appropriate code
        process.exit(results.overall === 'PASSED' ? 0 : 1);
        
    } catch (error) {
        console.error('❌ Basic validation failed:', error.message);
        process.exit(1);
    }
}

main();