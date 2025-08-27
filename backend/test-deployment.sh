#!/bin/bash

# Perfect AI Prompts - Deployment Security Test Script
# This script tests your deployment for security and functionality

echo "🚀 Perfect AI Prompts - Deployment Security Test"
echo "=================================================="

# Check if URL is provided
if [ -z "$1" ]; then
    echo "Usage: ./test-deployment.sh https://your-deployed-url.railway.app"
    echo "Example: ./test-deployment.sh https://prompt-polisher-production-abc123.railway.app"
    exit 1
fi

API_URL="$1"
echo "Testing API at: $API_URL"
echo ""

# Test 1: Health Check
echo "🏥 Test 1: Health Check"
echo "----------------------"
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$API_URL/health" 2>/dev/null)
HTTP_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed"
    cat /tmp/health_response.json | jq . 2>/dev/null || cat /tmp/health_response.json
else
    echo "❌ Health check failed (HTTP $HTTP_CODE)"
    cat /tmp/health_response.json 2>/dev/null
fi
echo ""

# Test 2: Security Headers
echo "🔒 Test 2: Security Headers"
echo "--------------------------"
HEADERS=$(curl -s -I "$API_URL/health" 2>/dev/null)

# Check for security headers
if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo "✅ X-Frame-Options header present"
else
    echo "❌ X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    echo "✅ X-Content-Type-Options header present"
else
    echo "❌ X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -q "X-XSS-Protection"; then
    echo "✅ X-XSS-Protection header present"
else
    echo "❌ X-XSS-Protection header missing"
fi
echo ""

# Test 3: Rate Limiting
echo "⚡ Test 3: Rate Limiting"
echo "-----------------------"
echo "Making 10 rapid requests to test rate limiting..."

RATE_LIMIT_FAILED=false
for i in {1..10}; do
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/health" 2>/dev/null)
    if [ "$RESPONSE" = "429" ]; then
        echo "✅ Rate limiting is working (got 429 on request $i)"
        RATE_LIMIT_FAILED=false
        break
    fi
    if [ $i -eq 10 ]; then
        RATE_LIMIT_FAILED=true
    fi
done

if [ "$RATE_LIMIT_FAILED" = true ]; then
    echo "⚠️ Rate limiting may not be working (no 429 responses)"
fi
echo ""

# Test 4: API Key Validation
echo "🔑 Test 4: API Key Validation Endpoint"
echo "-------------------------------------"
VALIDATION_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"apiKey": "sk-invalid-key-test"}' \
    -o /tmp/validation_response.json \
    "$API_URL/api/validation/openai-key" 2>/dev/null)
HTTP_CODE="${VALIDATION_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Validation endpoint is working"
    VALID=$(cat /tmp/validation_response.json | jq -r '.valid' 2>/dev/null)
    if [ "$VALID" = "false" ]; then
        echo "✅ Invalid API key properly rejected"
    else
        echo "⚠️ Invalid API key was accepted (unexpected)"
    fi
else
    echo "❌ Validation endpoint failed (HTTP $HTTP_CODE)"
fi
echo ""

# Test 5: SQL Injection Protection
echo "🛡️ Test 5: SQL Injection Protection"
echo "-----------------------------------"
INJECTION_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"text": "'; DROP TABLE users; --"}' \
    -o /tmp/injection_response.json \
    "$API_URL/api/prompts/improve" 2>/dev/null)
HTTP_CODE="${INJECTION_RESPONSE: -3}"

if [ "$HTTP_CODE" = "400" ]; then
    echo "✅ SQL injection attempt blocked"
elif [ "$HTTP_CODE" = "429" ]; then
    echo "✅ SQL injection attempt rate limited"
else
    echo "⚠️ Unexpected response to SQL injection test (HTTP $HTTP_CODE)"
fi
echo ""

# Test 6: XSS Protection
echo "🚫 Test 6: XSS Protection"
echo "------------------------"
XSS_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"text": "<script>alert('\''xss'\'')</script>"}' \
    -o /tmp/xss_response.json \
    "$API_URL/api/prompts/improve" 2>/dev/null)
HTTP_CODE="${XSS_RESPONSE: -3}"

if [ "$HTTP_CODE" = "400" ]; then
    echo "✅ XSS attempt blocked"
elif [ "$HTTP_CODE" = "429" ]; then
    echo "✅ XSS attempt rate limited"
else
    echo "⚠️ Unexpected response to XSS test (HTTP $HTTP_CODE)"
fi
echo ""

# Test 7: System Test
echo "🔧 Test 7: System Test"
echo "----------------------"
SYSTEM_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/system_response.json \
    "$API_URL/api/validation/system-test" 2>/dev/null)
HTTP_CODE="${SYSTEM_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ System test passed"
    cat /tmp/system_response.json | jq . 2>/dev/null || cat /tmp/system_response.json
elif [ "$HTTP_CODE" = "503" ]; then
    echo "⚠️ Some system components not ready (HTTP 503)"
    cat /tmp/system_response.json | jq . 2>/dev/null || cat /tmp/system_response.json
else
    echo "❌ System test failed (HTTP $HTTP_CODE)"
fi
echo ""

# Test 8: CORS Configuration
echo "🌍 Test 8: CORS Configuration"
echo "-----------------------------"
CORS_RESPONSE=$(curl -s -H "Origin: chrome-extension://test" -I "$API_URL/health" 2>/dev/null)
if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ CORS headers present"
else
    echo "⚠️ CORS headers may not be configured"
fi
echo ""

# Summary
echo "📋 DEPLOYMENT TEST SUMMARY"
echo "========================="
echo ""

# Check critical issues
CRITICAL_ISSUES=0

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "503" ]; then
    echo "❌ CRITICAL: API is not responding properly"
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
fi

if ! echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo "❌ CRITICAL: Missing security headers"
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
fi

if [ $CRITICAL_ISSUES -eq 0 ]; then
    echo "🎉 DEPLOYMENT LOOKS GOOD!"
    echo ""
    echo "Next Steps:"
    echo "1. Set your environment variables (OpenAI API key, Stripe keys)"
    echo "2. Update your extension with this API URL: $API_URL/api"
    echo "3. Test the complete flow with the extension"
    echo ""
    echo "Your API URL for the extension: $API_URL/api"
else
    echo "⚠️ ISSUES FOUND: $CRITICAL_ISSUES critical issues detected"
    echo "Please review the test results above and fix any critical issues."
fi

# Cleanup temp files
rm -f /tmp/health_response.json /tmp/validation_response.json /tmp/injection_response.json /tmp/xss_response.json /tmp/system_response.json

echo ""
echo "Test completed at: $(date)"