import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";

@Entity('peers_history')
export class PeerHistoryEntity extends BaseEntity<PeerHistoryEntity> {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'varchar', length: 128, nullable: true})
    name: string;

    @Column({type: 'int'})
    peer_id: number;

    @CreateDateColumn({name: 'created_at', type: 'timestamp'})
    createdAt: Date;

    @UpdateDateColumn({name: 'updated_at', type: 'timestamp'})
    updatedAt: Date;

}
