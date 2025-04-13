declare module 'rtf-parser' {
	interface RTFContent {
		value: string;
	}

	interface RTFParagraph {
		content: RTFContent[];
	}

	interface RTFDocument {
		content: RTFParagraph[];
	}

	function string(text: string | Buffer, callback: (err: Error | null, doc: RTFDocument) => void): void;

	export default {
		string
	};
}
