'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import * as uuid from "uuid/v4";
import * as fs from "fs";
import * as jmp from "jmp";


const pythonTerminalName = 'Jupyter Console';
let pythonTerminal: vscode.Terminal | null = null;
let sock: jmp.Socket = null;
let address: string | null = null;

const extPath = vscode.extensions.getExtension("dubravsky.vscode-variable-explorer").extensionPath;
const kernelSpecFile = path.join(extPath, "ipython-kernel.json");

let onNewVars: vscode.EventEmitter<string[]> = new vscode.EventEmitter<string[]>();
let onNewVarsEvent: vscode.Event<string[]> = onNewVars.event;
let treeDataProvider: VariableDataProvider | null = null;


function createPythonTerminal() {
    pythonTerminal = vscode.window.createTerminal(pythonTerminalName);
    pythonTerminal.sendText(`jupyter console -f "${kernelSpecFile}"`);
    initSocket(kernelSpecFile);
}

function initSocket(specPath) {
    try {
        let kSpec = JSON.parse(fs.readFileSync(specPath).toString());
        address = `${kSpec.transport}://${kSpec.ip}:${kSpec.shell_port}`;
        sock = new jmp.Socket("dealer", kSpec.scheme, kSpec.key);
        sock.connect(address);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            console.log('Kernel spec file not found, will retry:', specPath);
            setTimeout(function () { initSocket(specPath); }, 2000);
          } else {
            throw err;
          }
    }
}

function updateVariableExplorer() {
    if (sock === null) {
        console.log("Socket not defined.");
        return;
    }
    
    var request = new jmp.Message();
    request.idents = [];
    request.header = {
        "msg_id": uuid(),
        "username": "user",
        "session": uuid(),
        "msg_type": "execute_request",
        "version": "5.0",
    };
    request.parent_header = {};
    request.metadata = {};
    let varReq = "{k: type(globals()[k]) for k in globals() if not "
        + "k.startswith('_') and not k in ['In', 'Out', 'exit', 'quit', 'get_ipython']}";
    request.content = {"code": "",
                       "silent": "False",
                       "store_history": "False",
                       "user_expressions": {"vars": varReq}};
    sock.on('message', processKernelResponse);
    sock.send(request);
}

function processKernelResponse(msg) {
    console.log("Got reply from kernel.");
    let varStr = msg['content']['user_expressions']['vars']['data']['text/plain'];
    let vars = varStr.slice(1, -1).split(",");
    onNewVars.fire(vars);
    treeDataProvider.refresh(vars);
    sock.removeListener('message', processKernelResponse);
}

function sendSelectionFnc() {
    if (pythonTerminal === null) {
        createPythonTerminal();
    }

    const editor = vscode.window.activeTextEditor;
    let selection = editor.selection;
    let text = editor.document.getText(selection);
    if (text.length === 0) {
        text = editor.document.lineAt(editor.selection.active.line).text;
    }

    pythonTerminal.sendText(text);
    setTimeout(function () { pythonTerminal.sendText('\n'); }, 10);
    pythonTerminal.show(true);
    setTimeout(function () { updateVariableExplorer(); }, 100);
}

function sendFileFnc() {
    if (pythonTerminal === null) {
        createPythonTerminal();
    }

    const editor = vscode.window.activeTextEditor;
    const filename = editor.document.fileName;

    pythonTerminal.sendText(`%run ${filename}`);
    setTimeout(function () { pythonTerminal.sendText('\n'); }, 10);
    pythonTerminal.show(true);
    setTimeout(function () { updateVariableExplorer(); }, 100);
}

function removeKernelSpecFile() {
    try {
        fs.unlinkSync(kernelSpecFile);
    }
    catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    removeKernelSpecFile();
    vscode.window.onDidCloseTerminal(function (terminal) {
        if (terminal.name === pythonTerminalName) {
            pythonTerminal = null;
            sock.close();
            sock = null;
        }
    });

    treeDataProvider = new VariableDataProvider();
    vscode.window.registerTreeDataProvider("variables", treeDataProvider);
    vscode.window.createTreeView("variables", { treeDataProvider });

    let sendSelection = vscode.commands.registerCommand('sendSelection', sendSelectionFnc);
    let sendFile = vscode.commands.registerCommand('sendFile', sendFileFnc);
    let refresh = vscode.commands.registerCommand('refresh', function () { updateVariableExplorer(); });
    context.subscriptions.push(sendSelection);
    context.subscriptions.push(sendFile);
    context.subscriptions.push(refresh);
}

onNewVarsEvent(function (vars) {
    treeDataProvider.refresh(vars);
});

class VariableDataProvider implements vscode.TreeDataProvider<string> {

    public variables: string[] = [];
    private _onDidChangeTreeData: vscode.EventEmitter<string|null> = new vscode.EventEmitter<string|null>();
    readonly onDidChangeTreeData: vscode.Event<string|null> = this._onDidChangeTreeData.event;

    refresh(vars?: string[]): void {
        if (vars) {
            this.variables = vars;
        }
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element: string): vscode.TreeItem {
		return new vscode.TreeItem(element);
    }

    getChildren(element?: string): string[] {
		if (element) {
			return [];
		} else {
			return this.variables.sort();
		}
    }
}

export function deactivate() {
}