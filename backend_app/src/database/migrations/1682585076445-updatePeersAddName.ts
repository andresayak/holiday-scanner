import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class updatePeersAddName1682585076445 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('peers', [
            new TableColumn({
                name: 'name',
                type: 'varchar(128)',
                isNullable: true,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
