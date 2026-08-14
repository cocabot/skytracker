#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function createContext() {
    const context = {
        console,
        setTimeout,
        clearTimeout,
        Date,
        Math,
        JSON,
        Error,
        Map,
        Set,
        Promise,
        Array,
        Object,
        Number,
        String,
        Boolean,
        parseInt,
        parseFloat,
        isNaN,
        Infinity,
        NaN,
        performance: { now: () => Date.now() },
        URLSearchParams,
        URL
    };
    context.global = context;
    context.window = context;
    context.document = {
        createElement() {
            return {
                style: {},
                className: '',
                innerHTML: '',
                appendChild() {},
                addEventListener() {},
                remove() {}
            };
        },
        addEventListener() {},
        body: { appendChild() {}, removeChild() {} },
        head: { appendChild() {} },
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    return vm.createContext(context);
}

function load(context, rel) {
    const filename = path.join(root, rel);
    const code = fs.readFileSync(filename, 'utf8');
    vm.runInContext(code, context, { filename });
}

async function main() {
    const context = createContext();
    load(context, 'tests/test-framework.js');
    load(context, 'js/geo.js');
    load(context, 'js/task-engine.js');
    load(context, 'js/sample-tasks.js');
    load(context, 'js/weather-service.js');
    load(context, 'js/thermal-predictor.js');
    load(context, 'js/wind-estimator.js');
    load(context, 'js/race-computer.js');
    load(context, 'tests/unit/geo.test.js');
    load(context, 'tests/unit/task-engine.test.js');
    load(context, 'tests/unit/thermal-predictor.test.js');
    load(context, 'tests/unit/race-weather.test.js');

    const results = await context.TestFramework.runAllSuites();
    let failed = 0;
    let passed = 0;
    for (const suite of results) {
        for (const test of suite.tests) {
            if (test.status === 'pass') {
                passed++;
                console.log(`  PASS  ${suite.name} › ${test.name}`);
            } else {
                failed++;
                console.log(`  FAIL  ${suite.name} › ${test.name}`);
                console.log(`        ${test.error}`);
            }
        }
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
