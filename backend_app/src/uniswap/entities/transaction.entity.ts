import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";

@Entity('transactions')
export class TransactionEntity extends BaseEntity<TransactionEntity> {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'varchar', length: 66})
    hash: string;

    @Column({type: 'varchar', length: 32})
    network: string;

    @Column({type: 'integer', nullable: true})
    blockNumber: number;

    @Column({type: 'integer', nullable: true})
    transactionIndex: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    from: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    to: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    gasPrice: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    gasUsed: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    gasLimit: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    value: string;

    @Column({type: 'text', nullable: true})
    data: string;

    @Column({type: 'integer', nullable: true})
    nonce: number;

    @Column({type: 'integer', nullable: true})
    chainId: number;

    @Column({type: 'integer', nullable: true})
    status: number;

    @Column({type: 'integer', nullable: true})
    type: number;

    @Column({type: 'varchar', length: 42, nullable: true})
    routerAddress: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    pairAddress: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    maxAmount: string;

    @Column({type: 'decimal', precision: 11, scale: 2, nullable: true})
    maxAmountUsd: number;

    @Column({type: 'decimal', precision: 11, scale: 2, nullable: true})
    profit: number;

    @Column({type: 'decimal', precision: 11, scale: 2, nullable: true})
    profitReal: number;

    @Column({type: 'varchar', length: 128, nullable: true})
    method: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    reserves0: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    reserves1: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    token0: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    token1: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    amount0: string;

    @Column({type: 'varchar', length: 128, nullable: true})
    amount1: string;

    @Column({type: 'decimal', precision: 11, scale: 2, nullable: true})
    amount0Usd: number;

    @Column({type: 'decimal', precision: 11, scale: 2, nullable: true})
    amount1Usd: number;

    @Column({type: 'text', nullable: true})
    logs: string;

    @Column({type: 'boolean', default: false})
    isTested: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

}
