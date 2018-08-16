# vscode-variable-explorer

(First probe into making a) Visual Studio Code extension implementing a simple variable explorer for interactive Python sessions.

## Features

The extension publishes two commands (Variable Explorer: Send selection to Jupyter console and Variable Explorer: Run file in Jupyter console) to send code from editor to be evaluated, and implements a tree view to display variables of the resulting interactive session.

## Installation

Download and place into your Visual Studio Code extensions folder.

## Requirements

You need to have Jupyter Console on your PATH.

Communication with IPython kernel is done over zmq sockets and you may need to rebuild [`zeromq`](https://github.com/zeromq/zeromq.js) bindings to fit with your specific Electron version using
```
npm rebuild zeromq --runtime=electron --target=1.7.12
```
where you replace 1.7.12 with the version of Electron used by your Visual Studio Code. You can find it by typing process.versions.electron in Developer Tools console.

## Known Issues

First code sent to a new Jupyter Console doesn't get evaluated automatically. User needs to focus console and press (Alt+)Enter to force evaluation. For further sends this doesn't happen.

(While the extension communicates with kernel about session variables by zmq messaging, sending of code to console is done by simply Terminal.sendText of the vscode API. The text is pasted to the console, but can't really force its evaluation, even by adding trailing newlines. I found a trick of a small delay before sending the trailing newline, which makes the console evaluate the code. However this doesn't work the very first time)

## Release Notes

### 0.0.1

Proof of concept, finally it works
