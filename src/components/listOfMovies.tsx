'use client';

import React from "react";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination"

import Image from 'next/image'

const ListOfMovies = (props: ListOfMoviesProps) => {
	const {isOpen, tableData, setIsOpen, pages, activePage, callSearch, getTorrent, startStreaming} = props;

	return (
		<div>

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				{/*<DialogTrigger>Open</DialogTrigger>*/}
				<DialogContent className="max-h-[80vh] overflow-y-auto max-w-[90vw] sm:max-w-[60%]">
					<DialogHeader>
						<DialogTitle>Select a movie form the list </DialogTitle>
						<DialogDescription>
						</DialogDescription>
					</DialogHeader>
					<Table className="mt-2 w-full">
						<TableHeader>
							<TableRow>
								{tableData.some(data => data.image) && <TableHead className="w-[100px]">Image</TableHead>}
								<TableHead>Name</TableHead>
								{tableData.some(data => data.image) && <TableHead>Size</TableHead>}
								{tableData.some(data => data.image) && <TableHead>Downloaded</TableHead>}
								{tableData.some(data => data.image) && <TableHead>Seed</TableHead>}
							</TableRow>
						</TableHeader>
						<TableBody>
							{tableData.some(data => data.image) && tableData.map(({
																																			name,
																																			image,
																																			size,
																																			link,
																																			icon1,
																																			icon2,
																																			downloaded,
																																			seed
																																		}, index) => (
								<TableRow key={index} onClick={() => getTorrent(link)}>
									<TableCell><Image alt='cover' src={image} height={128} width={84}/></TableCell>
									<TableCell>
										<div className="flex items-center">{name}{icon1 &&
                        <Image alt='subs' src={icon1} height={32} width={32} className="h-8"/>}{icon2 &&
                        <Image alt='audio' src={icon2} height={32} width={32} className="h-8"/>}</div>
									</TableCell>
									<TableCell>{size}</TableCell>
									<TableCell>{downloaded}</TableCell>
									<TableCell>{seed}</TableCell>
								</TableRow>
							)) || tableData.map((fileObj, index) => (
								<TableRow key={index} onClick={() => startStreaming(index)}>
									<TableCell>
										<div className="flex items-center gap-x-4">
											{fileObj.name}
											{fileObj.watched && (<Image
												src="/watched.svg"
												alt="watched"
												width={28}
												height={28}
												priority
											/>)}
										</div>
									</TableCell>
								</TableRow>
							))}

						</TableBody>

					</Table>
					<Pagination>
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious href="#"/>
							</PaginationItem>
							{Array.from({length: pages}, (_, index) => (
								<PaginationItem key={index}>
									<PaginationLink isActive={activePage === index} href="#"
																	onClick={() => callSearch(index)}>{index + 1}</PaginationLink>
								</PaginationItem>
							))}
							<PaginationItem>
								<PaginationNext href="#"/>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</DialogContent>
			</Dialog>

		</div>)


};

export default ListOfMovies;
