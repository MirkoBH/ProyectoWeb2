import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { User } from "./user.entity";

@Entity("cars")
export class Car {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  brand!: string;

  @Column()
  model!: string;

  @Column({ type: "int" })
  year!: number;

  @Column({ type: "int", name: "kilometers" })
  kilometers!: number;

  @Column()
  fuel!: string;

  @Column()
  transmission!: string;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  price!: number;

  @Column()
  province!: string;

  @Column({ nullable: true })
  city!: string | null;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "text", nullable: true, name: "main_image_url" })
  mainImageUrl!: string | null;

  @Column({ type: "text", nullable: true, name: "ai_status" })
  aiStatus!: string | null;

  @Column({ type: "text", nullable: true, name: "ai_damage_summary" })
  aiDamageSummary!: string | null;

  @Column({ type: "text", nullable: true, name: "ai_price_range" })
  aiPriceRange!: string | null;

  @Column({ name: "seller_id" })
  sellerId!: string;

  @ManyToOne(() => User, (user) => user.cars, { onDelete: "CASCADE" })
  seller!: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
