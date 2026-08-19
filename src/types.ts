export type Session = {
	cookie: string;
	bookingId: number;
};

export type Product = {
	id: number;
	name: string;
	price?: number;
	status?: string;
};

export type CsvProduct = {
	name: string;
	price: number;
	active: boolean;
	photo?: string;
};
