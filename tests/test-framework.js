// 軽量テストフレームワーク
class TestFramework {
    static suites = new Map();
    static currentSuite = null;

    static describe(suiteName, suiteFunction, type = 'unit') {
        const suite = {
            name: suiteName,
            type: type,
            tests: [],
            beforeEach: null,
            afterEach: null,
            beforeAll: null,
            afterAll: null
        };

        this.currentSuite = suite;
        this.suites.set(suiteName, suite);

        try {
            suiteFunction();
        } catch (error) {
            console.error(`Error in test suite ${suiteName}:`, error);
        }

        this.currentSuite = null;
    }

    static it(testName, testFunction) {
        if (!this.currentSuite) {
            throw new Error('Test must be inside a describe block');
        }

        this.currentSuite.tests.push({
            name: testName,
            function: testFunction,
            status: 'pending',
            error: null,
            duration: 0
        });
    }

    static beforeEach(setupFunction) {
        if (!this.currentSuite) {
            throw new Error('beforeEach must be inside a describe block');
        }
        this.currentSuite.beforeEach = setupFunction;
    }

    static afterEach(teardownFunction) {
        if (!this.currentSuite) {
            throw new Error('afterEach must be inside a describe block');
        }
        this.currentSuite.afterEach = teardownFunction;
    }

    static beforeAll(setupFunction) {
        if (!this.currentSuite) {
            throw new Error('beforeAll must be inside a describe block');
        }
        this.currentSuite.beforeAll = setupFunction;
    }

    static afterAll(teardownFunction) {
        if (!this.currentSuite) {
            throw new Error('afterAll must be inside a describe block');
        }
        this.currentSuite.afterAll = teardownFunction;
    }

    static async runAllSuites() {
        const results = [];
        
        for (const [suiteName, suite] of this.suites) {
            const result = await this.runSuite(suite);
            results.push(result);
        }
        
        return results;
    }

    static async runSuitesByType(type) {
        const results = [];
        
        for (const [suiteName, suite] of this.suites) {
            if (suite.type === type) {
                const result = await this.runSuite(suite);
                results.push(result);
            }
        }
        
        return results;
    }

    static async runSuite(suite) {
        console.log(`Running test suite: ${suite.name}`);
        
        const result = {
            name: suite.name,
            type: suite.type,
            tests: [],
            duration: 0
        };

        const suiteStartTime = performance.now();

        try {
            // beforeAll実行
            if (suite.beforeAll) {
                await suite.beforeAll();
            }

            // 各テストを実行
            for (const test of suite.tests) {
                const testResult = await this.runTest(test, suite);
                result.tests.push(testResult);
            }

            // afterAll実行
            if (suite.afterAll) {
                await suite.afterAll();
            }

        } catch (error) {
            console.error(`Error in suite ${suite.name}:`, error);
        }

        const suiteEndTime = performance.now();
        result.duration = Math.round(suiteEndTime - suiteStartTime);

        return result;
    }

    static async runTest(test, suite) {
        const testStartTime = performance.now();
        
        const result = {
            name: test.name,
            status: 'pending',
            error: null,
            duration: 0
        };

        try {
            // beforeEach実行
            if (suite.beforeEach) {
                await suite.beforeEach();
            }

            // テスト実行
            await test.function();
            
            result.status = 'pass';

            // afterEach実行
            if (suite.afterEach) {
                await suite.afterEach();
            }

        } catch (error) {
            result.status = 'fail';
            result.error = error.message || error.toString();
            console.error(`Test failed: ${test.name}`, error);
        }

        const testEndTime = performance.now();
        result.duration = Math.round(testEndTime - testStartTime);

        return result;
    }

    // アサーション関数
    static expect(actual) {
        return {
            toBe(expected) {
                if (actual !== expected) {
                    throw new Error(`Expected ${expected}, but got ${actual}`);
                }
            },

            toEqual(expected) {
                if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                    throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
                }
            },

            toBeTruthy() {
                if (!actual) {
                    throw new Error(`Expected truthy value, but got ${actual}`);
                }
            },

            toBeFalsy() {
                if (actual) {
                    throw new Error(`Expected falsy value, but got ${actual}`);
                }
            },

            toBeNull() {
                if (actual !== null) {
                    throw new Error(`Expected null, but got ${actual}`);
                }
            },

            toBeUndefined() {
                if (actual !== undefined) {
                    throw new Error(`Expected undefined, but got ${actual}`);
                }
            },

            toBeInstanceOf(expectedClass) {
                if (!(actual instanceof expectedClass)) {
                    throw new Error(`Expected instance of ${expectedClass.name}, but got ${actual.constructor.name}`);
                }
            },

            toContain(expected) {
                if (Array.isArray(actual)) {
                    if (!actual.includes(expected)) {
                        throw new Error(`Expected array to contain ${expected}`);
                    }
                } else if (typeof actual === 'string') {
                    if (actual.indexOf(expected) === -1) {
                        throw new Error(`Expected string to contain ${expected}`);
                    }
                } else {
                    throw new Error('toContain can only be used with arrays or strings');
                }
            },

            toHaveLength(expected) {
                if (actual.length !== expected) {
                    throw new Error(`Expected length ${expected}, but got ${actual.length}`);
                }
            },

            toThrow(expectedError) {
                let threw = false;
                let error = null;
                
                try {
                    if (typeof actual === 'function') {
                        actual();
                    }
                } catch (e) {
                    threw = true;
                    error = e;
                }
                
                if (!threw) {
                    throw new Error('Expected function to throw an error');
                }
                
                if (expectedError && error.message !== expectedError) {
                    throw new Error(`Expected error message "${expectedError}", but got "${error.message}"`);
                }
            },

            toBeCloseTo(expected, precision = 2) {
                const diff = Math.abs(actual - expected);
                const tolerance = Math.pow(10, -precision) / 2;
                
                if (diff > tolerance) {
                    throw new Error(`Expected ${actual} to be close to ${expected} (precision: ${precision})`);
                }
            },

            toBeGreaterThan(expected) {
                if (actual <= expected) {
                    throw new Error(`Expected ${actual} to be greater than ${expected}`);
                }
            },

            toBeLessThan(expected) {
                if (actual >= expected) {
                    throw new Error(`Expected ${actual} to be less than ${expected}`);
                }
            },

            toMatch(pattern) {
                if (typeof pattern === 'string') {
                    if (actual.indexOf(pattern) === -1) {
                        throw new Error(`Expected "${actual}" to match "${pattern}"`);
                    }
                } else if (pattern instanceof RegExp) {
                    if (!pattern.test(actual)) {
                        throw new Error(`Expected "${actual}" to match ${pattern}`);
                    }
                } else {
                    throw new Error('toMatch expects a string or RegExp');
                }
            }
        };
    }

    // モック関数
    static createMock(originalFunction) {
        const mock = function(...args) {
            mock.calls.push(args);
            mock.callCount++;
            
            if (mock.mockReturnValue !== undefined) {
                return mock.mockReturnValue;
            }
            
            if (mock.mockImplementation) {
                return mock.mockImplementation(...args);
            }
            
            if (originalFunction) {
                return originalFunction(...args);
            }
        };

        mock.calls = [];
        mock.callCount = 0;
        mock.mockReturnValue = undefined;
        mock.mockImplementation = null;

        mock.mockReturnValueOnce = function(value) {
            mock.mockReturnValue = value;
            return mock;
        };

        mock.mockImplementationOnce = function(fn) {
            mock.mockImplementation = fn;
            return mock;
        };

        mock.toHaveBeenCalled = function() {
            if (mock.callCount === 0) {
                throw new Error('Expected mock to have been called');
            }
        };

        mock.toHaveBeenCalledTimes = function(times) {
            if (mock.callCount !== times) {
                throw new Error(`Expected mock to have been called ${times} times, but was called ${mock.callCount} times`);
            }
        };

        mock.toHaveBeenCalledWith = function(...args) {
            const found = mock.calls.some(call => 
                call.length === args.length && 
                call.every((arg, index) => arg === args[index])
            );
            
            if (!found) {
                throw new Error(`Expected mock to have been called with ${JSON.stringify(args)}`);
            }
        };

        return mock;
    }

    // スパイ関数
    static spyOn(object, methodName) {
        const originalMethod = object[methodName];
        const spy = this.createMock(originalMethod);
        
        spy.restore = function() {
            object[methodName] = originalMethod;
        };
        
        object[methodName] = spy;
        return spy;
    }

    // 非同期テスト用ヘルパー
    static async waitFor(condition, timeout = 5000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (await condition()) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        throw new Error(`Condition not met within ${timeout}ms`);
    }

    // DOM テスト用ヘルパー
    static createTestElement(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div);
        
        return {
            element: div,
            cleanup() {
                document.body.removeChild(div);
            }
        };
    }
}

// グローバルに公開
window.TestFramework = TestFramework;
window.describe = TestFramework.describe.bind(TestFramework);
window.it = TestFramework.it.bind(TestFramework);
window.beforeEach = TestFramework.beforeEach.bind(TestFramework);
window.afterEach = TestFramework.afterEach.bind(TestFramework);
window.beforeAll = TestFramework.beforeAll.bind(TestFramework);
window.afterAll = TestFramework.afterAll.bind(TestFramework);
window.expect = TestFramework.expect.bind(TestFramework);