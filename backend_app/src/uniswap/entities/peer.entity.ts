import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";

@Entity('peers')
export class PeerEntity extends BaseEntity<PeerEntity> {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'varchar', length: 128, nullable: true})
    name: string;

    @Column({type: 'text', nullable: true})
    enode: string;

    @Column({type: 'varchar', length: 42, unique: true})
    ip_address: string;

    @Column({type: 'varchar', length: 64, nullable: true})
    port: string;

    @Column({type: 'varchar', length: 64, nullable: true})
    country: string;

    @Column({type: 'varchar', length: 64, nullable: true})
    region: string;

    @Column({type: 'varchar', length: 64, nullable: true})
    city: string;

    @Column({type: 'varchar', length: 64, nullable: true})
    latitude: string;

    @Column({type: 'varchar', length: 64, nullable: true})
    longitude: string;

    @Column({type: 'int', unsigned: true, nullable: true})
    ping: number;

    @CreateDateColumn({name: 'created_at', type: 'timestamp'})
    createdAt: Date;

    @UpdateDateColumn({name: 'updated_at', type: 'timestamp'})
    updatedAt: Date;

}
