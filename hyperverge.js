#!/usr/bin/env node

const request = require('request');
const program = require('commander');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const Readable = require('stream').Readable;
const packageJson = require('./package.json');

/**
 * A list of supported actions by the Hyperverge API
 * @type {string[]}
 */
const availableActions = ['test', 'readPAN', 'readPassport', 'readAadhaar', 'readKYC'];

/**
 * Helper to convert paths to absolute paths
 * @param filePath - path to make absolute
 * @returns {*}
 */
function normalisePath(filePath) {
    if (/^\//.test(filePath)) {
        // Absolute path, use as is
        return filePath;
    }
    return path.resolve(process.cwd(), filePath);
}


/**
 * File types supported by hyperverge
 * @type {RegExp}
 */
const supportedFileExtensions = /(gif|jpe?g|tiff|png|pdf)$/i;

/**
 * Script configuration. Built using the CLI parameters and the configuration file if provided
 * @type {{}}
 */
let CONFIG = {};

/**
 * A common point handler to handle critical errors. Prints the error message using the
 * @param code
 * @param err
 * @param rest
 */
function handleError(code, err, ...rest) {
    /**
     * Error codes and their message factory mappings
     * @type {Object}
     */
    const errors = {
        100: () => 'Missing file and directory path. One must be provided.',
        101: () => 'Parameters for file and directory path cannot both be present. Provide one or the other.',
        102: () => 'Invalid path to configuration file',
        103: action => `${action}: Invalid action "${action}". Must be one of ${JSON.stringify(availableActions)}`,
        104: (action, msg) => `${action}: ${msg || `Failed to ${action}`}`,
        105: () => 'Missing or invalid credentials. Check your appKey or appId value in the configuration'
    };

    // Report underlying exception
    console.error('\n\nException Details:\n', err, '\n\n');


    // Log human readable error message
    console.error(chalk.red(errors[code](...rest) + '\nDetailed exception information if available should be printed above\n\n'));

    // Kill the process
    process.exit(code);
}

/**
 * Write the results to the output file if provided. If no file is specified the result is written to the console
 * @param result
 */
function writeResults(result, output) {
    const s = new Readable();
    s.push(JSON.stringify(result) + '\n');
    s.push(null);
    if (output) {
        try {
            s.pipe(fs.createWriteStream(output, {
                flags: 'a+',
                encoding: 'utf8'
            }));
        } catch (e) {
            handleError(104, e, 'write', `Failed to write result to ${output}`);
        }
    } else {
        s.pipe(process.stdout);
    }
}

/**
 * Helper to retrieve a list of compatible files recursively from the directory specified by the provided path.
 * @param directory - The path to a directory to recursively extract compatible files from
 * @returns {*[]}
 */
function listFiles(directory) {
    const entryPaths = fs.readdirSync(directory).map(entry => path.join(directory, entry));
    const filePaths = entryPaths.filter(entryPath => fs.statSync(entryPath).isFile());
    const dirPaths = entryPaths.filter(entryPath => !filePaths.includes(entryPath));
    const dirFiles = dirPaths.reduce((prev, curr) => prev.concat(listFiles(curr)), []);
    return [...filePaths, ...dirFiles]
        .filter(path => supportedFileExtensions.test(path))
        .map(path => normalisePath(path));
}


// Setup CLI API and parse the incoming cli Arguments
program
    .version(packageJson.version)
    .option('-c, --config [path]', 'Config JSON File containing any or all of the other parameters. action, directory, file, output, appKey, appId, host')
    .option('-a, --action [action]', `The action to run. One of ${JSON.stringify(availableActions)}`, 'test')
    .option('-d, --directory [path]', 'The path to a folder of items to be used for the request')
    .option('-f, --file [path]', 'The path to a folder of items to be used for the request')
    .option('-o, --output [path]', 'The file to write the result of the operation to', '')
    .option('-k, --app-key [key]', 'The Hyperverge App Key', '')
    .option('-i, --app-id [id]', 'The Hyperverge App ID', '')
    .option('-h, --host [host]', 'The Hypervege host to use')
    .parse(process.argv);

const {
    config: cliConfig,
    action: cliAction,
    directory: cliDirectory,
    file: cliFile,
    output: cliOutput,
    appKey: cliAppKey,
    appId: cliAppId,
    host: cliHost
} = program;

// Initialise config with CLI parameters
CONFIG = {
    action: cliAction,
    directory: cliDirectory,
    file: cliFile,
    output: cliOutput,
    appKey: cliAppKey,
    appId: cliAppId,
    host: cliHost
};

// Check if a config file was passed
if (cliConfig) {
    try {
        const {
            host,
            action, directory, file, output, appKey, appId

        } = require(path.resolve(process.cwd(), cliConfig));

        // Update CONFIG object with values from the provided JSON.
        // CLI Parameters get priority
        CONFIG.action = CONFIG.action || action;
        CONFIG.directory = CONFIG.directory || directory;
        CONFIG.file = CONFIG.file || file;
        CONFIG.output = CONFIG.output || output;
        CONFIG.appKey = CONFIG.appKey || appKey;
        CONFIG.appId = CONFIG.appId || appId;
        CONFIG.host = CONFIG.host || host;

        CONFIG = {
            action, directory, file, output, appKey, appId, host,
            ...CONFIG
        };
    } catch (e) {
        handleError(102, e);
    }
}

// Normalise trailing slash and default host if needed
CONFIG.host = CONFIG.host || 'https://ind-docs.hyperverge.co/v2.0';
CONFIG.host = CONFIG.host[CONFIG.host.length - 1] === '/' ? CONFIG.host : CONFIG.host + '/';

// Normalise the paths
CONFIG.directory = CONFIG.directory && normalisePath(CONFIG.directory);
CONFIG.file = CONFIG.file && normalisePath(CONFIG.file);

/**
 * Helper to mask sensitive strings
 * @param str - string to mask
 * @returns {string} -  a masked string
 */
function mask(str) {
    if (str.length < 6) {
        return str.replace(/./g, '#');
    }
    return str.split('').map((c, idx) => idx < 2 || idx > str.length - 3 ? c : '#').join('');
}

const {
    action,
    file,
    directory,
    output,
    appKey,
    appId,
    host
} = CONFIG;

console.log(
    chalk.gray(
        'Booting using configuration:\n',
        JSON.stringify(
            {
                action,
                file,
                directory,
                output,
                appKey: mask(appKey),
                appId: mask(appId),
                host
            },
            null,
            2
        )
    )
);

// Switch based on the requested action
switch (action) {

    case 'test':
        testConnection();
        break;

    default:
        // Ensure action requested is supported
        if (!availableActions.find(a => a === action)) {
            handleError(103, 'Invalid action', action);
        }

        // Check if file and directory conflict is present
        if (file && directory) {
            handleError(101, 'File and directory paths passed to CLI simultaneously');
        } else if (file) {
            // A file path was provided
            // Attempt upload to service
            uploadFile(file, action)
                .then(data => {
                    if (data.err) {
                        // Something went wrong
                        writeResults(data, output);
                        handleError(104, data.err, action);
                    } else {
                        // Success
                        console.info(chalk.green(`${action}: Success! FILE: ${file}`));
                        writeResults(data, output);
                    }
                });
        } else if (directory) {
            // A directory path was provided
            try {
                // Try reading the directory recursively for compatible files
                const files = listFiles(directory);
                console.log(JSON.stringify(files,null,2));

                // Initialise lists to track results, errors
                const results = [];
                const errors = [];

                // Build a promise chain to execute the requests serially
                const promises = Promise.resolve();
                files.reduce((acc, file, idx) => {
                    return acc.then(() => {

                        // For each item, after the previous item has completed, attempt an upload
                        return uploadFile(file, action)
                            .then(data => {
                                if (data.err) {
                                    // This item failed, report the error and add it to the error list
                                    console.error(chalk.red(`${action}: Failed! FILE: ${file}`));
                                    errors.push(data);
                                } else {
                                    // This item succeeded, report the success and add it to the result list
                                    console.info(chalk.green(`${action}: Success! FILE: ${file}`));
                                    results.push(data);
                                }

                                if (errors.length + results.length === files.length) {
                                    // All items are complete, flush the results
                                    promises.then(() => {
                                        writeResults({
                                            errors,
                                            results
                                        }, output);
                                    });
                                }
                                return Promise.resolve(data);
                            });
                    });
                }, promises);

            } catch (e) {
                // Failed to read the directory
                handleError(104, e, action, `Failed to read files from directory ${directory}`);
            }
        } else {
            // No file or directory was provided
            handleError(100, 'file or directory is required');
        }
}

/**
 * Helper to test if the connection to Hyperverge is working
 */
function testConnection() {
    console.info(chalk.gray('test: Testing connection to Hyperverge...'));
    request(host, function (err, response, body) {
        if (err) {
            return handleError(104, err, 'test', `Failed to connect to Hyperverge on host ${host}`);
        }
        console.info(chalk.green('test: ' + body));
    });
}

/**
 * Helper to upload a file to the specified Hyperverge service
 * @param file - The path to the file to upload
 * @param action -  The Hyperverge action to perform
 * @returns {Promise} - A promise which always resolves. Check for the `err` key to decide if something went wrong
 */
function uploadFile(file, action) {
    console.info(chalk.gray(`${action}: Running on ${file}`));

    // Infer the file extension to ensure compatibility
    let ext;
    try {
        ext = path.extname(file).split('.')[1];
    } catch (e) {
        console.error(e);
        ext = 'image';
    }
    console.info(chalk.gray(`${action}: TYPE: ${ext}`));
    if (!supportedFileExtensions.test(ext)) {
        handleError(104, `Unsupported file format ${ext} for ${file}`, action, `Unsupported file format ${ext} for ${file}`);
    }

    // Build the request body from the file stream
    let formData = {};
    try {
        fs.statSync(file);
        formData[ext] = fs.createReadStream(file);
    } catch (e) {
        handleError(104, e, action, `Failed to read file ${file}`);
    }

    // Ensure credentials are available
    if (!appId || !appKey) {
        handleError(105, 'Missing appId or appKey');
    }

    // Make a request
    return new Promise(resolve => {
        request({
            url: host + action,
            method: 'POST',
            formData: formData,
            headers: {
                'appid': appId,
                'appkey': appKey,
                'Accept': 'application/json'
            },
            json: true
        }, function (err, response, body) {
            const {status, statusCode, result} = body;
            return resolve({
                action,
                file,
                status,
                statusCode,
                result,
                err
            });
        });
    });

}