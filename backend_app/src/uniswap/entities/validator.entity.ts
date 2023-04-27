import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";

@Entity('validators')
export class ValidatorEntity extends BaseEntity<ValidatorEntity> {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'varchar', length: 128, nullable: true})
    name: string;

    @Column({type: 'varchar', length: 128, unique: true})
    extra: string;

    @Column({type: 'varchar', length: 64, nullable: true})
    address: string;

    @Column({type: 'int', unsigned: true, nullable: true})
    lastBlock: number;

    @CreateDateColumn({name: 'created_at', type: 'timestamp'})
    createdAt: Date;

    @UpdateDateColumn({name: 'updated_at', type: 'timestamp'})
    updatedAt: Date;

}
