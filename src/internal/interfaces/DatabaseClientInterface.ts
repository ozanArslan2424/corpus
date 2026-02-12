export interface DatabaseClientInterface {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
}
