# Hyperverge CLI

A CLI tool to interface with the [Hyperverge API](https://github.com/hyperverge/kyc-india-rest-api#hyperverge-india-kyc-api-documentation) for document verification.



## Installation

```bash
npm i -g hyperverge
```


## Usage

#### Test the CLI connection

To test if your Hyperverge is reachable run. You should see an `AoK!` if everything went well.
```bash
hyperverge
test: Testing connection to Hyperverge...
test: AoK!
```

#### Getting help

```bash
hyperverge --help

Usage: hyperverge [options]

Options:
  -V, --version           output the version number
  -c, --config [path]     Config JSON File containing any or all of the other parameters. action, directory, file, output, appKey, appId, host (default: "./credentials.json")
  -a, --action [action]   The action to run. One of ["test","readPAN","readPassport","readAadhaar","readKYC"] (default: "test")
  -d, --directory [path]  The path to a folder of items to be used for the request
  -f, --file [path]       The path to a folder of items to be used for the request
  -o, --output [path]     The file to write the result of the operation to (default: "")
  -k, --app-key [key]     The Hyperverge App Key (default: "")
  -i, --app-id [id]       The Hyperverge App ID (default: "")
  -h, --host [host]       The Hypervege host to use
  -h, --help              output usage information

```


### Abstract Example
```bash
hyperverge \
        --config /path/to/config.js \
        --host 'https://ind-docs.hyperverge.co/v2.0' \
        --app-key '<HYPERVERGE_APP_KEY>' \
        --app-id '<HYPERVERGE_APP_ID>' \
        --action '<test|readPAN|readPassport|readAAdhaar|readKYC>' \
        --directory '/path/directory' \
        --file '/path/to/file' \
        --output '/path/to/output'
```

### Modes

The CLI can either upload one file to the service or attempt to recursively traverse a directory and attempt uploading
all compatible files.


#### File Mode

To upload a single file to a service, specify the file option either via CLI or JSON config


```bash
hyperverge -a readKYC -f /path/to/file -c config.json
```

The output will be a single JSON object. If an error occurred, the JSON object will have an `err` key set.

Sample output:
```json
{
  "action": "readKYC",
  "file": "/path/to/file",
  "status": "success",
  "statusCode": "200",
  "result": [
    ... results from Hyperverge ...
  ],
  "err": null
}
```

#### Directory Mode
To upload a directory of files recursively, specify the directory option either via CLI options or config file

```bash
hyperverge -a readKYC -d /path/to/directory -c config.json
```

The output will be a single JSON object having the keys `success` and `errors` which are both array of objects similar 
to the one above.



## Configuration

This configuration can be passed via the CLI options listed above or via JSON configuration file.

Sample Configuration JSON:

```json
{
  "host": "https://ind-docs.hyperverge.co/v2.0",
  "appId": "xxxxx",
  "appKey": "xxxxx",
  "action": "readKYC",
  "file": "/path/to/file",
  "directory": "/path/to/directory",
  "output": "/path/to/output"
}
``` 


#### Notes:

* Passing both `file` and `directory` will cause an error. The CLI must be passed one or the other but not both.
* The `test` action does not require credentials but every other action must have `appKey` and `appId` passed
either via CLI or via the JSON configuration file.
* If an option is passed to the CLI both via a JSON configuration and CLI parameters, the CLI parameter values get 
precedence
* All options are supported both via JSON and CLI parameters