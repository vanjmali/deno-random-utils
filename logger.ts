// version: 2
// deno-lint-ignore-file no-explicit-any
import * as Path from "https://deno.land/std@0.178.0/path/mod.ts";
import Day from "npm:dayjs";

const headerPrefix = `╔════ `;
const middlePrefix = `║ `;
const footerPrefix = `╚═════════ `;

/**
 * Outputs colorful output for easier reading
 *
 * @func info Outputs in green
 * @func debug Outputs in blue
 * @func warn Outputs in yellow
 * @func error Outputs in red
 */
const output = {
	debug: (message: MessageLog, usePrevLog = true) =>
		custom(
			message,
			[terminalColor.foreground.cyan],
			2,
			false,
			usePrevLog || undefined,
		),
	info: (message: MessageLog, usePrevLog = true) =>
		custom(
			message,
			[terminalColor.foreground.green],
			2,
			false,
			usePrevLog || undefined,
		),
	warn: (message: MessageLog, usePrevLog = true) =>
		custom(
			message,
			[terminalColor.foreground.yellow],
			2,
			false,
			usePrevLog || undefined,
		),
	error: (message: MessageLog, usePrevLog = true) =>
		custom(
			message,
			[terminalColor.foreground.red],
			2,
			true,
			usePrevLog || undefined,
		),
};

export const outputOnLog = <typeof output>{};
for (const k in output) {
	if (Object.prototype.hasOwnProperty.call(output, k)) {
		const key = k as keyof typeof output;
		const func = output[key];
		outputOnLog[key] = (message: Parameters<typeof func>["0"]) =>
			func(message, true);
	}
}

const rootFolder = Deno.cwd();
const rootFolderToLogs = Path.join(rootFolder, "logs");

const folderDateFormat = "YYYY-MM-DD";

type LogOptions<T> = {
	/**
	 * Should display log in the console
	 * @default true
	 */
	shouldConsoleLog?: boolean;
	/**
	 * Should save log in `logs` folder
	 * @default true
	 */
	shouldSaveConsole?: boolean;
	/**
	 * The start log values to initialize with.
	 * @default {}
	 */
	initValues?: T;
	/**
	 * The timeout in milliseconds to save the log file.
	 * 
	 * This is useful for when you want to log multiple messages at once, and you don't want to save the file multiple times.
	 * 
	 * Setting this to 0 will close the file after each log, no open connections will be kept.
	 * @default 5000
	 */
	fileTimeout?: number;
};

/**
 * This {@link Log} class can be used to log console messages in both terminal console and file.
 *
 * Create a new {@link Log} instance by providing a path of the log which is also the path in `logs` folder.
 * You can also prompt in a type definition to use {@link Log.values} values.
 *
 * Use the {@link Log.info} {@link Log.debug} {@link Log.warn} {@link Log.error} methods to log messages.
 *
 * Use {@link Log.values} to save custom data that will automatically be printed in the log when an error occurs.
 */
export class Log<Values = Record<string, unknown>> {
	public static readonly debug = output.debug;
	public static readonly info = output.info;
	public static readonly warn = output.warn;
	public static readonly error = output.error;

	private _logFile: Deno.FsFile | null = null;
	private _logFileTimeout: number | null = null;
	private _logFileTaken = false;
	private _logFileDate: string;

	private readonly _values: Values = <any>{};
	/**
	 * Log values here are useful for debugging.
	 * You can manually display them by calling {@link valuesLog} function,
	 * or it will be displayed when an error occurs.
	 *
	 * You can add new values by assigning it: `values = {var_name: 'value'}` or `values.var_name = 'value'`.
	 * You'll need to manually update those values if any variable changes.
	 *
	 * To be up-to-date, you can assign the type when calling this class:
	 * ```typescript
	 * import { Log } from 'https://deno.land/x/random_utils@v0.1.0/logger.ts';
	 * const log = new Log<{
	 *     x: number, // becomes `log.values.x`. There is no undefined-checking here, so try adding `| undefined` or `?:` if you want to use it
	 *     y: number
	 * }>('math');
	 * log.values.x = 6;
	 * log.values.y = 2;
	 * // Alternative: log.values = {x: 6, y: 2};
	 *
	 * // And then use `log.values` with those variables, as that allows you to also store them in log right away for displaying error messages.
	 * log.info(log.values.x + log.values.y); // prints `8`
	 *
	 * // You can also reference the values object for easier access.
	 * log.values.x = 1;
	 * const values = log.values;
	 * values.x = 2;
	 * log.valuesLog(); // prints `{x: 2}`
	 * ```
	 */
	public set values(data) {
		for (const key in data) {
			(this._values as any)[key] = data[key];
		}
	}
	public get values() {
		return this._values;
	}
	public shouldConsoleLog: Required<LogOptions<Values>["shouldConsoleLog"]>;
	public shouldSaveConsole: Required<LogOptions<Values>["shouldSaveConsole"]>;
	/**
	 * The timeout in milliseconds to save the log file.
	 * 
	 * Changing this value will affect the future logs.
	 */
	public fileTimeout: Required<LogOptions<Values>["fileTimeout"]>;

	/**
	 * This class allows you to organize logging, by creating file structures in logs folder.
	 *
	 * It also crates window logs in the console for better looking organization, but also useful for debugging
	 * @param filePath the relative path for logs folder, it will end up being similar to `logs/{date}/{filePath}`. Use `/` to separate folders
	 */
	constructor(
		public readonly filePath: string,
		options?: LogOptions<Values>,
	) {
		// if filePath var is empty, default to a randomized file
		if (filePath.length == 0) {
			const randomFile = crypto.randomUUID();
			filePath = `other/${randomFile}`;
			custom(
				`Output class Log: filePath is empty, defaulting to ${filePath}`,
				[terminalColor.foreground.yellow],
				2,
			);
		}
		// Get folder structure
		const folders = filePath.split("/");
		const fileName = folders.pop() ?? `unknown-${crypto.randomUUID()}.log`;
		const file = fileName.endsWith(".log") ? fileName : `${fileName}.log`;

		this._logFileDate = Day().format(folderDateFormat); // Make sure initialize after updateDate() so the log file is created

		this.relativePath = [...folders, file];

		this.shouldConsoleLog = options?.shouldConsoleLog ?? true;
		this.shouldSaveConsole = options?.shouldSaveConsole ?? true;
		this.fileTimeout = options?.fileTimeout ?? 5000;
		this.values = options?.initValues ?? <Values>{};
	}

	public readonly debug = (message: MessageLog, ...args: string[]) =>
		this.createNewLog(
			"debug",
			message,
			args,
			[terminalColor.foreground.cyan],
			2,
		);
	public readonly info = (message: MessageLog, ...args: string[]) =>
		this.createNewLog(
			"info",
			message,
			args,
			[terminalColor.foreground.green],
			2,
		);
	public readonly warn = (message: MessageLog, ...args: string[]) =>
		this.createNewLog(
			"warn",
			message,
			args,
			[terminalColor.foreground.yellow],
			2,
		);
	public readonly error = (message: MessageLog, ...args: string[]) =>
		this.createNewLog(
			"error",
			message,
			args,
			[terminalColor.foreground.red],
			2,
		);

	/**
	 * Displays the values in the console
	 */
	public readonly valuesLog = () => {
		const color = terminalColor.foreground.magenta;
		console.log(
			color + middlePrefix +
			`[VALUES] ${colorString(`[${this.relativePathString}]`, [terminalColor.foreground.cyan])}`,
		);
		Deno.inspect(this.values, { colors: true }).split("\n")
			.forEach((line) => console.log(color + middlePrefix + `${line}`));
		console.log(
			color + footerPrefix +
			`[END OF VALUES] ${colorString(`[${this.relativePathString}]`, [terminalColor.foreground.cyan])}`,
		);
	};

	private readonly _logDataQueue: Uint8Array[] = [];

	/**
	 * Updates the folder where the log will be stored and creates it if it doesn't exist
	 */
	protected readonly writeLog = async (data: Uint8Array) => {
		const date = Day().format(folderDateFormat);
		this._logDataQueue.push(data);
		if (this._logFileTaken) {
			// If there is a log file, return as it is already being written to
			return;
		}

		if (!this._logFile || this._logFileDate !== date) {
			this._logFileDate = date; // update date
			this.closeLogs(); // close old logs

			const absPath = this.absolutePath;
			// open file in append mode to just insert data
			await Deno.mkdir(absPath.split(Path.basename(absPath))[0], { recursive: true });
			this._logFile = await Deno.open(absPath, {
				create: true,
				append: true
			});

			// Set timeout to close the file after inactivity
			this._logFileTimeout = this.fileTimeout ?? 0 > 0
				? setTimeout(this.closeLogs, this.fileTimeout)
				: null;
		}

		// Log file is being written to
		for (const data of this._logDataQueue) {
			await this._logFile.write(data);
		}
		this._logDataQueue.length = 0;
		this._logFileTaken = false;
		if (!this._logFileTimeout) this.closeLogs();
	};

	/**
	 * Closes the log file if open.
	 * This is called automatically after {@link fileTimeout} miliseconds of inactivity
	 * 
	 * Manually call this function to close the log file
	 */
	public readonly closeLogs = () => {
		if (this._logFile) {
			// close old file if it exists
			this._logFile.close();
			this._logFile = null;
			this._logFileTimeout && clearTimeout(this._logFileTimeout);
			this._logFileTimeout = null;
		}
	};

	/** Display log file and save to the log file */
	protected readonly createNewLog = async (
		type: keyof typeof output,
		message: MessageLog,
		args: string[],
		colors: TerminalColor[],
		getLine = 0,
	) => {
		try {
			const date = Day();
			const file = getFileCode(getLine + 1); // get function file from stack trace

			const relativePath = this.relativePathString;

			// Place arguments to %s for arguments in message
			let content = message;
			content?.replace &&
				args.forEach((v) => content = content.replace("%s", v));

			// Display data
			if (this.shouldConsoleLog) {
				custom(
					content,
					colors,
					getLine + 1,
					type == "error",
					relativePath,
				);
				if (type == "error") this.valuesLog();
			}

			// Save data
			if (this.shouldSaveConsole) {
				const timestamp = date.format("h:mm:ss A");
				// Setup text
				const text =
					`[${timestamp}] [${type.toUpperCase()}] ${file} ${content}\n` +
					(type == "error"
						? `[${timestamp}] ↦ ${Deno.inspect(this._values, { colors: true })}\n`
						: "");

				await this.writeLog(new TextEncoder().encode(text));
			}
		} catch (e) {
			console.error(e);
		}
		return null;
	};

	public get absolutePath() {
		return Path.resolve(
			rootFolderToLogs,
			this._logFileDate,
			...this.relativePath,
		);
	}
	public readonly relativePath: string[];
	public get relativePathString() {
		return this.relativePath.join(Path.sep);
	}

	public readonly highlight = highlight;
	public readonly h = highlight;
}

/** Makes the message highlighted, making it stand out when used in output log */
export function highlight(message: string) {
	return colorString(message, [terminalColor.foreground.white]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageLog =
	| string
	| Record<string, unknown>
	| Error
	| number
	| Array<unknown>
	| any;

/** This is used to determine which 'window' the console is currently displaying */
let relativePathBeingDisplayed = "";

/**
 * @param message Text to display in output
 * @param colors Use {@link terminalColor} variable to select values more easily
 * @param getLine (optional) Set which line to get in function stack; This is already predefined - increase only when is called by a custom color display for each function in it
 * @param isError (optional) Use console.error instead of console.log
 */
export function custom(
	message: MessageLog,
	colors: TerminalColor[],
	getLine = 0,
	isError = false,
	relativePath?: string | true,
) {
	// Parse message
	if (message?.constructor == Error) {
		message = (message.stack ?? "").split("\n");
		// Mark red all lines that have mentioned file in project and the first line
		for (let i = 0; i < message.length; i++) {
			const msg = (message as string[])[i];
			if (
				i == 0 || msg.includes(Path.join(rootFolder, "src")) ||
				msg.includes(Path.join(rootFolder, "dist"))
			) {
				message[i] = colorString(msg, [
					terminalColor.background.red,
					terminalColor.foreground.white,
				]);
			}
		}
		message = message.map((v: string) =>
			colorString(v, [terminalColor.foreground.red])
		).join("\n");
		isError = true;
	}
	message = isObject(message) || Array.isArray(message)
		? Deno.inspect(message, { depth: 5, colors: true })
		: message !== undefined
			? message !== null ? message.toString() : "null"
			: "undefined";
	while (message.includes(terminalColor.special.normal)) {
		message = message.replace(
			terminalColor.special.normal,
			colors.join(""),
		);
	}

	if (typeof message === "string") {
		message = message.split("\n")
			.map((line, i) =>
				// Add the missing middle prefix for styling
				(i > 0
					? colorString(middlePrefix, [
						terminalColor.special.normal,
						terminalColor.foreground.red,
					])
					: "") +
				line
			).join("\n");
	}

	// Get prefix
	let file = getFileCode(getLine + 1);
	const fileColor = colors[0].charAt(3) == "m"
		? [terminalColor.background.cyan]
		: [
			terminalColor.foreground.white,
			`\x1b[4${colors[0].charAt(3)}m` as TerminalColor,
		];
	file = file.replaceAll(terminalColor.special.normal, fileColor.join(""));

	let shouldMiddlePrefix = false;
	// Insert middlePrefix to the console view window if in any
	if (
		((relativePath === true && relativePathBeingDisplayed.length > 0) ||
			relativePathBeingDisplayed === relativePath)
	) {
		shouldMiddlePrefix = true;
	} else {
		// Reset window if the log is for different window
		if (relativePathBeingDisplayed.length > 0) {
			console.log(footerPrefix);
			relativePathBeingDisplayed = "";
		}
		// Display new window / header
		if (relativePath && relativePath !== true) {
			relativePathBeingDisplayed = relativePath;
			console.log(headerPrefix + relativePath);
			shouldMiddlePrefix = true;
		}
	}
	(isError ? console.error : console.log)(
		colorString(shouldMiddlePrefix ? middlePrefix : "", colors) +
		`${colorString(file, fileColor)} ${colorString(message, colors)}`,
	);
	return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" &&
		value.constructor === Object;
}

/**
 * Generates a new error and reads its stack trace
 * @param getLine The line function to get from the stack
 * @returns The file line that called this function
 */
function getFileCode(getLine: number) {
	try {
		const error = new Error();
		if (!error.stack) {
			throw new Error(`error.stack is ${typeof error.stack}`);
		}
		const frames = error.stack.split("\n");
		const frame =
			frames[getLine > frames.length ? frames.length - 1 : getLine + 1];
		const lineNumber = frame.split(":").reverse()[1];
		// const functionName = frame!.split(" ")[5];
		const filePathFrame = frame.split(":").reverse();
		const filePath = (
			filePathFrame.length < 2
				? filePathFrame[filePathFrame.length]
				: filePathFrame[2])
			.replace(/\\/g, "/").replace(rootFolder, "")
			.split("/").filter(v => v.length > 0).reverse().slice(0, 2).reverse().join("/");
		return `[${filePath}:${lineNumber}]`;
	} catch (_) {
		return "[unknown]";
	}
}

/**
 * Returns string in color (for terminal)
 * @param string Text to display in output
 * @param prefixes string colors - use terminalColor variable to select values more easily
 * @param suffixes after string colors - use terminalColor variable to select values more easily
 */
export function colorString(
	string: string,
	prefixes: TerminalColor[],
	suffixes: TerminalColor[] = [terminalColor.special.normal],
) {
	return `${prefixes.join("")}${string}${suffixes.join("")}`;
}

export const terminalColor = {
	foreground: {
		black: "\x1b[30m",
		red: "\x1b[31m",
		green: "\x1b[32m",
		yellow: "\x1b[33m",
		blue: "\x1b[34m",
		magenta: "\x1b[35m",
		cyan: "\x1b[36m",
		white: "\x1b[37m",
	},
	background: {
		black: "\x1b[40m",
		red: "\x1b[41m",
		green: "\x1b[42m",
		yellow: "\x1b[44m",
		blue: "\x1b[44m",
		magenta: "\x1b[45m",
		cyan: "\x1b[46m",
		white: "\x1b[47m",
	},
	special: {
		normal: "\x1b[0m",
		bold: "\x1b[1m",
		/** Does not work on WinterNode's console */
		dim: "\x1b[2m",
		underlined: "\x1b[4m",
		blink: "\x1b[5m",
		reverse_video: "\x1b[7m",
		invisible: "\x1b[8m",
	},
} as const;

type ValueOf<T> = T[keyof T];

export type TerminalColor =
	| ValueOf<typeof terminalColor["foreground"]>
	| ValueOf<typeof terminalColor["background"]>
	| ValueOf<typeof terminalColor["special"]>;

export default Log;
